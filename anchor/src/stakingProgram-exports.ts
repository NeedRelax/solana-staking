// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import StakingProgramIDL from '../target/idl/staking_program.json'
import type { StakingProgram } from '../target/types/staking_program'

// Re-export the generated IDL and type
export { StakingProgram, StakingProgramIDL }

// The programId is imported from the program IDL.
export const STAKING_PROGRAM_ID = new PublicKey(StakingProgramIDL.address)

// This is a helper function to get the stakingProgram Anchor program.
export function getStakingProgram(provider: AnchorProvider, address?: PublicKey): Program<StakingProgram> {
  return new Program(
    { ...StakingProgramIDL, address: address ? address.toBase58() : StakingProgramIDL.address } as StakingProgram,
    provider,
  )
}

// This is a helper function to get the program ID for the stakingProgram program depending on the cluster.
export function getStakingProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      // This is the program ID for the stakingProgram program on devnet and testnet.
      return new PublicKey('coUnmi3oBUtwtd9fjeAvSsJssXh5A5xyPbhpewyzRVF')
    case 'mainnet-beta':
    default:
      return STAKING_PROGRAM_ID
  }
}
