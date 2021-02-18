from typing import Tuple, Set, FrozenSet
from slither import Slither
from slither.slithir.operations import (
    HighLevelCall,
    LowLevelCall,
    Send,
    Transfer,
)
from slither.core.declarations import Function

CONTRACTS_TO_IGNORE = {
    "BorrowerOperationsTester",
    "TestAUTO",
    "PropertiesAUTO",
    "ActivePoolTester",
    "EchidnaTester",
    "DefaultPoolTester",
    "NonPayable",
    "StabilityPoolTester",
    "EchidnaProxy",
    "Destructible",
}


def is_externally_callable(function: Function) -> bool:
    return function.visibility in ["public", "external"]


def find_externally_callable_paths(
    slither: Slither, target_function: Function, current_path: Tuple[Function, ...] = ()
) -> FrozenSet[Tuple[Function, ...]]:
    current_path = (target_function, *current_path)

    result_paths: Set[Tuple[Function, ...]] = set()

    for contract in slither.contracts:
        if contract.name in CONTRACTS_TO_IGNORE:
            continue
        for function in contract.functions:
            if function in current_path:
                continue

            called_functions = set()
            for _, f in function.high_level_calls:
                called_functions.add(f)
            for _, f in function.library_calls:
                called_functions.add(f)
            for f in function.internal_calls:
                if isinstance(f, Function):
                    called_functions.add(f)

            if target_function in called_functions:
                result_paths |= find_externally_callable_paths(
                    slither, function, current_path
                )

    if is_externally_callable(target_function):
        result_paths.add(current_path)

    return frozenset(result_paths)


def source_mapping_to_github_url(source_mapping) -> str:
    result = source_mapping["filename_relative"]
    lines = source_mapping["lines"]
    result += "#L" + str(lines[0])
    if len(lines) > 1:
        result += "-L" + str(lines[-1])
    return result


slither = Slither(".")

print("# ETH Egress")
print("")

for contract in slither.contracts:
    if contract.name in CONTRACTS_TO_IGNORE:
        continue
    if contract.is_interface:
        continue
    for function in contract.functions_and_modifiers_declared:
        for node in function.nodes:
            for ir in node.irs:
                if not isinstance(ir, (HighLevelCall, LowLevelCall, Transfer, Send)):
                    continue
                if ir.call_value is None:
                    continue
                print(
                    f"## {function.canonical_name} {function.visibility} can send ETH"
                )
                print("")
                source_mapping = ir.node.source_mapping
                paths = find_externally_callable_paths(slither, function)
                print("")
                print("### in externally callable paths")
                print("")
                if paths:
                    for path in paths:
                        path_str = " -> ".join(
                            f"`{x.canonical_name}` *{x.visibility}*" for x in path
                        )
                        print(f"- {path_str}")
                else:
                    print("none")
                print("")

print("")
print("# ETH Ingress")
print("")

for contract in slither.contracts:
    if contract.name in CONTRACTS_TO_IGNORE:
        continue
    if contract.is_interface:
        continue
    for function in contract.functions_and_modifiers_declared:
        if not is_externally_callable(function):
            continue
        if not function.payable:
            continue
        print(f"- `{function.canonical_name}` can receive ETH")
