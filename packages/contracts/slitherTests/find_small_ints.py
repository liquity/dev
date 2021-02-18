from typing import Set, Optional, FrozenSet

from slither import Slither
from slither.core.solidity_types.elementary_type import Int, Uint
from slither.slithir.operations import Operation, OperationWithLValue
from slither.core.solidity_types.type import Type
from slither.core.solidity_types import (
    ElementaryType,
    MappingType,
    ArrayType,
    UserDefinedType,
)
from slither.core.declarations import Structure


def get_type(actual: Type, expected: Set[Type]) -> Optional[Type]:
    if isinstance(actual, list):
        for x in actual:
            t = get_type(x, expected)
            if t:
                return t
    if actual in expected:
        return actual
    if isinstance(actual, ElementaryType):
        return None
    if isinstance(actual, MappingType):
        t = get_type(actual.type_from, expected)
        if t:
            return t
        return get_type(actual.type_to, expected)
    if isinstance(actual, UserDefinedType) and isinstance(actual.type, Structure):
        for elem in actual.type.elems.values():
            t = get_type(elem.type, expected)
            if t:
                return t
        return None
    if isinstance(actual, ArrayType):
        return get_type(actual.type, expected)

    return None


small_int_types: FrozenSet[ElementaryType] = frozenset(
    ElementaryType(type_name)
    for type_name in Int + Uint
    if type_name not in set(["uint", "uint256", "int", "int256"])
)


def get_small_int(actual: Type) -> bool:
    return get_type(actual, small_int_types)


def process_ir(ir: Operation, lines_printed: Set[int]):
    line = ir.expression.source_mapping["lines"][0]
    if line in lines_printed:
        return

    lvalue = None
    if isinstance(ir, OperationWithLValue):
        if ir.lvalue:
            lvalue = get_small_int(ir.lvalue.type)

    read = next(
        filter(None, (get_small_int(x.type) for x in ir.read if hasattr(x, "type"))),
        None,
    )

    if lvalue and read:
        print(
            f"    - [ ] {line:4}: reads {read} and produces {lvalue}: {ir.expression}"
        )
    elif lvalue:
        print(f"    - [ ] {line:4}: produces {lvalue}: {ir.expression}")
    elif read:
        print(f"    - [ ] {line:4}: reads {read}: {ir.expression}")

    if lvalue or read:
        lines_printed.add(line)


slither = Slither(".")

for contract in slither.contracts:

    lower = contract.name.lower()
    if "echidna" in lower or "test" in lower or "properties" in lower:
        continue

    is_contract_printed = False

    def print_contract():
        global is_contract_printed
        if is_contract_printed:
            return
        print(f"- {contract.name}")
        is_contract_printed = True

    for v in contract.variables:
        if get_small_int(v.type):
            print_contract()
            print(f"  - {v.type} {v.name}")

    lines_printed = set()
    for function in contract.functions_and_modifiers_declared:
        # includes parameters and return values
        is_uint128_in_vars = any(
            True for v in function.variables if get_small_int(v.type)
        )
        if is_uint128_in_vars:
            print_contract()
            params_str: str = ", ".join(
                f"{p.type} {p.name}" for p in function.parameters
            )
            print(f"  - {function.name}({params_str}) {function.visibility}")
            for ir in function.slithir_operations:
                process_ir(ir, lines_printed)
