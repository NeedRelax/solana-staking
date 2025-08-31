const { PublicKey } = require('@solana/web3.js')
const { getAssociatedTokenAddressSync } = require('@solana/spl-token')

// --- 在这里修改你的地址 ---
const mintStr = '6zNdibRnksiHZjQJ8m6nA7L7uFRJYWeXWvGMHjeHbdeb'
const ownerStr = '6z5EypHVFrmgrDuJVQLAajRG8WgEr8uzfJWmqqcPUiWr'
// --- -------------------- ---

// 不要修改这里
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')

try {
  const mint = new PublicKey(mintStr)
  const owner = new PublicKey(ownerStr)

  const associatedTokenAccountAddress = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID)

  console.log('The Associated Token Account (ATA) address is:')
  console.log(associatedTokenAccountAddress.toBase58())
} catch (e) {
  console.error('Error:', e.message)
}
