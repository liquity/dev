// Buidler script for interacting with ABDKMath functions

const FunctionCaller = artifacts.require("FunctionCaller");

async function main() {
    const functionCaller = await FunctionCaller.new("Hello, world!");

    console.log("FunctioCaller address:", functionCaller.address);

    // --- Multiplication ---

    // 5 * 6
    // convert each uint to 64.64
    const res1 = await functionCaller.abdkMath_fromUInt_view(5)
    console.log(`5 as 64.64 fixed-point: ${res1}`)
    const res2 = await functionCaller.abdkMath_fromUInt_view(6)
    console.log(`6 as 64.64 fixed-point: ${res2}`)

    // perform mul operation in 64.64
    const res3 = await functionCaller.abdkMath_mul_view(res1, res2)
    const res4 = await functionCaller.abdkMath_toUInt_view(res3)
    console.log(`result of 5 * 6, performed in 64.64, converted back to uint64: ${res4}`)

    // 0.5 * 6 
    // get 0.5 as 64.64dec
    // const res5 = await functionCaller.abdkMath_divu_view(1,2)
    // console.log(`0.5 as 64.64 fixed-point: ${res5}`)
    // // get 6 as 64.64dec
    // const res6 = await functionCaller.abdkMath_fromUInt_view(6)
    // console.log(`6 as 64.64 fixed-point: ${res6}`)

    // // perform mul operation in 64.64
    // const res7 = await functionCaller.abdkMath_mul_view(res5, res6)
    // const res8 = await functionCaller.abdkMath_toUInt_view(res7)
    // console.log(`result of 0.5 * 6, performed in 64.64, converted back to uint64: ${res8}`)

    // --- Ratio Multiplication ---
    const res5 = await functionCaller.abdkMath_divu_view(1,2)
    console.log(`0.5 as 64.64 fixed-point: ${res5}`)

    // multiply the 64.64dec ratio by the uint, and convert result back to uint
    const res6 = await functionCaller.abdkMath_mulu_view(res5, 6)
    console.log(`result of 0.5 * 6, performed in 64.64, converted back to uint256: ${res6}`)
    // 

    //--- Division ---
    
    const res7 = await functionCaller.abdkMath_divu_view(11,10)
    console.log(`10/11 as 64.64 fixed-point: ${res7}`)

    const res8 = await functionCaller.abdkMath_mulu_view(res7, 1000)
    const res9 = await functionCaller.abdkMath_mulu_view(res7, 1000000)
    const res10 = await functionCaller.abdkMath_mulu_view(res7, 1000000000)
    const res11 = await functionCaller.abdkMath_mulu_view(res7, '1000000000000')
    const res12 = await functionCaller.abdkMath_mulu_view(res7, '1000000000000000')
    const res13 = await functionCaller.abdkMath_mulu_view(res7, '1000000000000000000')
    const res14 = await functionCaller.abdkMath_mulu_view(res7, '1000000000000000000000')
    const res15 = await functionCaller.abdkMath_mulu_view(res7, 
        '100000000000000000000000000000000000000000000000')
    console.log(`log fraction to increasing precision`)
    console.log(`${res8}`)
    console.log(`${res9}`)
    console.log(`${res10}`)
    console.log(`${res11}`)
    console.log(`${res12}`)
    console.log(`${res13}`)
    console.log(`${res14}`)
    console.log(`${res15}`)
    
    // seems accurate to 18 digits


  /* 
  --- Using ABDK functions in Liquity ---
  
  ABDK.mulu is for: (64.64dec * uint)  -> uint.  i.e. for stake * ratio -> reward

  ABDK.divu is for: (uint / uint)  -> 64.64dec.  i.e. for coll  / debt -> ICR.

  A 64.64dec is stored as a int128, which has 2**128 combinations. But the *max value we can represent* with that, 
  given it is a binary representation that ignores a 2*64 denominator... is 2**64. That's 19 digits.

 1)  Should be more than enough for all ratios that need to be stored as decimals, i.e. ICR:

  At 1ETH = 200CLV,

  Coll(ETH) -----  Debt(CLV) ----- ICR()
  1                 1               200

  Could just have an upper limit on ICR and say all above certain huge ICR get set to 2**64.  
  Since that is billions of ETH: 1 CLV.

  How about L_ETH, L_CLV, S_ETH, S_CLV?

  What about stake? 2**64 gives 20 digits, so no, likely cant store stake.  e.g. a corrected stake for a 1mil ether collateral
  needs 24 digits for the wei, then however many digits for the mantissa.

  So let's say we have a uint stake, to nearest whole wei, rounded down.

  Does it matter, given 1 wei is such a small value already - how bad can the losses get if stakes are rounded 
  to nearest wei?

  reward = stake * L - L(0)

  worstCaseLoss = 1 wei * L - L(0)

  L is rewards per ether staked, as share of total.  L_ETH/CLV and S_ETH/CLV also need to be ints?  What's max loss from rounding?

  For other calcs, we can convert to/from 64.64 format. */
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });