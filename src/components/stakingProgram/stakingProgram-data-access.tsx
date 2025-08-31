'use client' // 声明此文件为客户端组件，仅在客户端运行

// 从 @project/anchor 导入获取 Staking Program 和 Program ID 的函数
import { getStakingProgram, getStakingProgramId } from '@project/anchor'
// 导入 Solana 钱包适配器钩子，用于获取连接和钱包信息
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
// 导入 Solana web3.js 的核心类，用于处理公钥、交易和系统程序
import { Cluster, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
// 导入 Tanstack Query 钩子，用于数据查询和状态管理
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
// 导入 React 的 useMemo 钩子，用于记忆计算结果以优化性能
import { useMemo } from 'react'
// 导入自定义钩子，用于获取当前集群（网络）信息
import { useCluster } from '../cluster/cluster-data-access'
// 导入自定义钩子，用于获取 Anchor 提供者（Provider）
import { useAnchorProvider } from '../solana/solana-provider'
// 导入自定义钩子，用于显示交易成功的 Toast 通知
import { useTransactionToast } from '../use-transaction-toast'
// 导入 sonner 的 toast 函数，用于显示通知
import { toast } from 'sonner'
// 导入 SPL Token 相关函数，用于处理代币账户和销毁操作
import {
  TOKEN_2022_PROGRAM_ID, // SPL Token 2022 程序 ID
  getAssociatedTokenAddressSync, // 计算关联代币账户（ATA）地址
  createAssociatedTokenAccountInstruction, // 创建关联代币账户的指令
  createBurnInstruction, // 创建销毁代币的指令
} from '@solana/spl-token'
// 导入 Anchor 的 BN 类，用于处理大整数
import { BN } from '@coral-xyz/anchor'

/**
 * 主 Hook，用于与 Staking Program 交互，管理全局状态（如质押池）和管理员操作。
 */
export function useStakingProgram() {
  // 获取 Solana 网络连接
  const { connection } = useConnection()
  // 获取当前集群（网络）信息
  const { cluster } = useCluster()
  // 获取交易 Toast 通知工具
  const transactionToast = useTransactionToast()
  // 获取 Anchor 提供者，用于与链上程序交互
  const provider = useAnchorProvider()
  // 获取当前连接钱包的公钥
  const { publicKey } = useWallet()
  // 获取 Tanstack Query 的客户端实例，用于管理查询状态
  const queryClient = useQueryClient()

  // 使用 useMemo 计算 Staking Program 的程序 ID，确保只在集群变化时重新计算
  const programId = useMemo(() => getStakingProgramId(cluster.network as Cluster), [cluster])
  // 使用 useMemo 创建 Staking Program 实例，确保只在 provider 或 programId 变化时重新创建
  const program = useMemo(() => getStakingProgram(provider, programId), [provider, programId])

  // 派生质押池的 PDA（Program Derived Address）地址
  const poolPda = useMemo(() => {
    // 使用 'pool' 种子计算 PDA 地址
    return PublicKey.findProgramAddressSync([Buffer.from('pool')], programId)[0]
  }, [programId])
  // 派生质押金库的 PDA 地址
  const stakingVaultPda = useMemo(() => {
    // 使用 'staking_vault' 种子计算 PDA 地址
    return PublicKey.findProgramAddressSync([Buffer.from('staking_vault')], programId)[0]
  }, [programId])
  // 派生奖励金库的 PDA 地址
  const rewardVaultPda = useMemo(() => {
    // 使用 'reward_vault' 种子计算 PDA 地址
    return PublicKey.findProgramAddressSync([Buffer.from('reward_vault')], programId)[0]
  }, [programId])

  // 查询质押池（Pool）账户的状态
  const poolQuery = useQuery({
    // 定义查询的唯一 key，包含集群和质押池 PDA
    queryKey: ['staking', 'pool', { cluster, poolPda }],
    // 查询函数，异步获取质押池账户信息
    queryFn: async () => {
      try {
        // 尝试获取质押池账户数据
        return await program.account.pool.fetch(poolPda)
      } catch (e) {
        // 如果账户不存在，说明质押池尚未初始化
        console.log(`Pool account not found, it may need to be initialized: ${e}`)
        return null
      }
    },
    // 每 5 秒刷新一次数据，以更新奖励等信息
    refetchInterval: 5000,
  })

  // ---- Mutations for Transactions ----

  // 初始化质押池（管理员操作）
  const initialize = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'initialize', { cluster }],
    // mutation 函数，执行初始化质押池的链上操作
    mutationFn: (input: {
      stakingMint: PublicKey // 质押代币的 Mint 地址
      rewardMint: PublicKey // 奖励代币的 Mint 地址
      rewardRate: number // 奖励发放速率
      lockupDuration: number // 锁定期时长
    }) =>
      // 调用程序的 initialize 方法，设置奖励速率和锁定期
      program.methods
        .initialize(new BN(input.rewardRate), new BN(input.lockupDuration))
        .accounts({
          pool: poolPda, // 质押池账户
          admin: provider.wallet.publicKey, // 管理员公钥
          stakingMint: input.stakingMint, // 质押代币 Mint
          stakingVault: stakingVaultPda, // 质押金库
          rewardMint: input.rewardMint, // 奖励代币 Mint
          rewardVault: rewardVaultPda, // 奖励金库
          systemProgram: SystemProgram.programId, // 系统程序
          tokenProgram: TOKEN_2022_PROGRAM_ID, // SPL Token 程序
        })
        .rpc(), // 发送交易到链上
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示
      toast.success('Staking pool initialized successfully!')
      // 刷新质押池查询
      poolQuery.refetch()
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Failed to initialize pool: ${err.message}`)
    },
  })

  // 更新奖励率（管理员操作）
  const updateRewardRate = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'updateRewardRate', { cluster }],
    // mutation 函数，执行更新奖励率的链上操作
    mutationFn: (newRate: number) =>
      // 调用程序的 updateRewardRate 方法
      program.methods
        .updateRewardRate(new BN(newRate))
        .accounts({
          pool: poolPda, // 质押池账户
          admin: provider.wallet.publicKey, // 管理员公钥
        })
        .rpc(), // 发送交易到链上
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示
      toast.success('Reward rate updated!')
      // 刷新质押池查询
      poolQuery.refetch()
      // 延迟 1 秒后使金库余额和代币余额查询失效
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['vault-balance'] })
      }, 1000)
      queryClient.invalidateQueries({ queryKey: ['token-balance'] })
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Failed to update reward rate: ${err.message}`)
    },
  })

  // 向奖励池注资（管理员操作）
  const fundRewards = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'fundRewards', { cluster }],
    // mutation 函数，执行向奖励池注资的链上操作
    mutationFn: async (amount: number) => {
      // 检查质押池数据和钱包公钥是否有效
      if (!poolQuery.data || !provider.wallet.publicKey) throw new Error('Pool not loaded or wallet not connected')

      // 计算管理员的奖励代币关联账户（ATA）地址
      const funderWallet = getAssociatedTokenAddressSync(
        poolQuery.data.rewardMint,
        provider.wallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      )
      // 记录计算得到的 funderWallet 地址
      console.log(`[Fund Rewards] Calculated funder_wallet (Admin's Reward ATA): ${funderWallet.toBase58()}`)
      // 获取奖励代币的 decimals
      const decimals = await connection.getTokenSupply(poolQuery.data.rewardMint).then((res) => res.value.decimals)

      // 将输入金额转换为字符串
      const amountString = amount.toString()
      // 分离整数和小数部分
      const [integerPartStr, fractionalPartStr = ''] = amountString.split('.')
      // 创建 BN 实例表示 10
      const ten = new BN(10)
      // 创建 BN 实例表示 decimals
      const decimalsBN = new BN(decimals)
      // 计算 10^decimals 的乘数
      const multiplier = ten.pow(decimalsBN)
      // 将整数部分转换为 BN 并乘以乘数
      const integerPartBN = new BN(integerPartStr).mul(multiplier)
      // 处理小数部分，截取并补零
      const fractionalPartPadded = fractionalPartStr.slice(0, decimals).padEnd(decimals, '0')
      // 将小数部分转换为 BN
      const fractionalPartBN = new BN(fractionalPartPadded)
      // 计算最终的链上金额
      const scaledAmount = integerPartBN.add(fractionalPartBN)
      // 记录计算的金额
      console.log('scaledAmount: ', scaledAmount.toString())

      // 调用程序的 fundRewards 方法
      return program.methods
        .fundRewards(scaledAmount)
        .accounts({
          pool: poolPda, // 质押池账户
          admin: provider.wallet.publicKey, // 管理员公钥
          funderWallet: funderWallet, // 管理员的奖励代币 ATA
          rewardVault: rewardVaultPda, // 奖励金库
          rewardMint: poolQuery.data.rewardMint, // 奖励代币 Mint
          tokenProgram: TOKEN_2022_PROGRAM_ID, // SPL Token 程序
        })
        .rpc() // 发送交易到链上
    },
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示
      toast.success('Rewards funded successfully!')
      // 刷新质押池查询
      poolQuery.refetch()
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Failed to fund rewards: ${err.message}`)
    },
  })

  // 暂停程序（管理员操作）
  const pause = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'pause', { cluster }],
    // mutation 函数，执行暂停程序的链上操作
    mutationFn: () =>
      program.methods
        .pause()
        .accounts({ pool: poolPda, admin: publicKey }) // 指定质押池和管理员账户
        .rpc(), // 发送交易到链上
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示成功提示
      toast.success('Program paused')
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 刷新质押池查询
      poolQuery.refetch()
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Error: ${err.message}`)
    },
  })

  // 恢复程序（管理员操作）
  const unpause = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'unpause', { cluster }],
    // mutation 函数，执行恢复程序的链上操作
    mutationFn: () =>
      program.methods
        .unpause()
        .accounts({ pool: poolPda, admin: publicKey }) // 指定质押池和管理员账户
        .rpc(), // 发送交易到链上
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示成功提示
      toast.success('Program unpaused')
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 刷新质押池查询
      poolQuery.refetch()
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Error: ${err.message}`)
    },
  })

  // 更新锁定期时长（管理员操作）
  const updateLockupDuration = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'updateLockupDuration', { cluster }],
    // mutation 函数，执行更新锁定期时长的链上操作
    mutationFn: (newDuration: number) =>
      program.methods
        .updateLockupDuration(new BN(newDuration))
        .accounts({ pool: poolPda, admin: publicKey }) // 指定质押池和管理员账户
        .rpc(), // 发送交易到链上
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示成功提示
      toast.success('Lockup duration updated!')
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 刷新质押池查询
      poolQuery.refetch()
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Error: ${err.message}`)
    },
  })

  // 销毁奖励代币（管理员操作）
  const burnRewardTokens = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'burnRewardTokens', { cluster, publicKey }],
    // mutation 函数，执行销毁奖励代币的链上操作
    mutationFn: async (amount: number) => {
      // 检查管理员钱包和奖励代币 Mint 是否有效
      if (!publicKey || !poolQuery.data?.rewardMint) {
        throw new Error('Admin wallet not connected or reward mint not found')
      }

      // 获取奖励代币 Mint 地址
      const rewardMint = poolQuery.data.rewardMint
      // 计算管理员的奖励代币关联账户（ATA）地址
      const adminRewardWallet = getAssociatedTokenAddressSync(rewardMint, publicKey, false, TOKEN_2022_PROGRAM_ID)

      // 获取奖励代币的 decimals
      const decimals = await connection.getTokenSupply(rewardMint).then((res) => res.value.decimals)
      // 将输入金额转换为字符串
      const amountString = amount.toString()
      // 分离整数和小数部分
      const [integerPartStr, fractionalPartStr = ''] = amountString.split('.')
      // 创建 BN 实例表示 10
      const ten = new BN(10)
      // 创建 BN 实例表示 decimals
      const decimalsBN = new BN(decimals)
      // 计算 10^decimals 的乘数
      const multiplier = ten.pow(decimalsBN)
      // 将整数部分转换为 BN 并乘以乘数
      const integerPartBN = new BN(integerPartStr).mul(multiplier)
      // 处理小数部分，截取并补零
      const fractionalPartPadded = fractionalPartStr.slice(0, decimals).padEnd(decimals, '0')
      // 将小数部分转换为 BN
      const fractionalPartBN = new BN(fractionalPartPadded)
      // 计算最终的链上金额
      const scaledAmount = integerPartBN.add(fractionalPartBN)

      // 创建销毁代币的指令
      const burnInstruction = createBurnInstruction(
        adminRewardWallet, // 要销毁的账户（管理员的奖励代币 ATA）
        rewardMint, // 奖励代币 Mint
        publicKey, // 账户所有者（管理员）
        BigInt(scaledAmount.toString()), // 要销毁的代币数量
        [], // 多重签名者（无）
        TOKEN_2022_PROGRAM_ID, // SPL Token 程序
      )

      // 创建交易并添加销毁指令
      const transaction = new Transaction().add(burnInstruction)
      // 发送并确认交易
      const signature = await provider.sendAndConfirm(transaction)
      return signature
    },
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示
      toast.success('Reward tokens burned successfully!')
      // 使管理员的代币余额查询失效
      queryClient.invalidateQueries({
        queryKey: ['token-balance', publicKey?.toBase58(), poolQuery.data?.rewardMint?.toBase58()],
      })
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Burn failed: ${err.message}`)
    },
  })

  // 更改管理员（管理员操作）
  const changeAdmin = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'changeAdmin', { cluster, publicKey }],
    // mutation 函数，执行更改管理员的链上操作
    mutationFn: async (newAdminPublicKey: PublicKey) => {
      // 检查管理员钱包是否有效
      if (!publicKey) {
        throw new Error('Admin wallet not connected')
      }

      // 调用程序的 changeAdmin 方法
      return program.methods
        .changeAdmin(newAdminPublicKey)
        .accounts({
          pool: poolPda, // 质押池账户
          admin: publicKey, // 当前管理员公钥
        })
        .rpc() // 发送交易到链上
    },
    // 成功时的回调
    onSuccess: (signature, variables) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示，包含新管理员地址
      toast.success(`Admin changed successfully to: ${variables.toBase58()}`)
      // 使质押池查询失效以更新管理员地址
      queryClient.invalidateQueries({ queryKey: ['staking', 'pool', { cluster, poolPda }] })
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Failed to change admin: ${err.message}`)
    },
  })

  // 紧急提取质押代币（管理员操作）
  const emergencyWithdrawStakedTokens = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'emergencyWithdrawStakedTokens', { cluster, publicKey }],
    // mutation 函数，执行紧急提取质押代币的链上操作
    mutationFn: async ({ amount, destinationWallet }: { amount: number; destinationWallet: PublicKey }) => {
      // 检查管理员钱包和质押池数据是否有效
      if (!publicKey || !poolQuery.data) throw new Error('Admin wallet not connected or pool not loaded')

      // 获取质押代币 Mint 地址
      const stakingMint = poolQuery.data.stakingMint
      // 计算质押金库的 PDA 地址
      const stakingVault = PublicKey.findProgramAddressSync([Buffer.from('staking_vault')], programId)[0]

      // 获取质押代币的 decimals
      const decimals = await connection.getTokenSupply(stakingMint).then((res) => res.value.decimals)
      // 将输入金额转换为链上单位（简化版）
      const scaledAmount = new BN(amount * 10 ** decimals)

      // 调用程序的 emergencyWithdrawStakedTokens 方法
      return program.methods
        .emergencyWithdrawStakedTokens(scaledAmount)
        .accounts({
          pool: poolPda, // 质押池账户
          admin: publicKey, // 管理员公钥
          stakingVault: stakingVault, // 质押金库
          stakingMint: stakingMint, // 质押代币 Mint
          destinationWallet: destinationWallet, // 目标钱包地址
          tokenProgram: TOKEN_2022_PROGRAM_ID, // SPL Token 程序
        })
        .rpc() // 发送交易到链上
    },
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示
      toast.success('Emergency withdrawal of staked tokens successful!')
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Emergency withdrawal failed: ${err.message}`)
    },
  })

  // 紧急提取奖励代币（管理员操作）
  const emergencyWithdrawRewardTokens = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'emergencyWithdrawRewardTokens', { cluster, publicKey }],
    // mutation 函数，执行紧急提取奖励代币的链上操作
    mutationFn: async ({ amount, destinationWallet }: { amount: number; destinationWallet: PublicKey }) => {
      // 检查管理员钱包和质押池数据是否有效
      if (!publicKey || !poolQuery.data) throw new Error('Admin wallet not connected or pool not loaded')

      // 获取奖励代币 Mint 地址
      const rewardMint = poolQuery.data.rewardMint
      // 计算奖励金库的 PDA 地址
      const rewardVault = PublicKey.findProgramAddressSync([Buffer.from('reward_vault')], programId)[0]

      // 获取奖励代币的 decimals
      const decimals = await connection.getTokenSupply(rewardMint).then((res) => res.value.decimals)
      // 将输入金额转换为链上单位（简化版）
      const scaledAmount = new BN(amount * 10 ** decimals)

      // 调用程序的 emergencyWithdrawRewardTokens 方法
      return program.methods
        .emergencyWithdrawRewardTokens(scaledAmount)
        .accounts({
          pool: poolPda, // 质押池账户
          admin: publicKey, // 管理员公钥
          rewardMint: rewardMint, // 奖励代币 Mint
          rewardVault: rewardVault, // 奖励金库
          destinationWallet: destinationWallet, // 目标钱包地址
          tokenProgram: TOKEN_2022_PROGRAM_ID, // SPL Token 程序
        })
        .rpc() // 发送交易到链上
    },
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示
      toast.success('Emergency withdrawal of reward tokens successful!')
      // 使金库余额查询失效
      queryClient.invalidateQueries({ queryKey: ['vault-balance'] })
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Emergency withdrawal failed: ${err.message}`)
    },
  })

  // 返回所有相关数据和方法
  return {
    program, // Staking Program 实例
    programId, // 程序 ID
    poolPda, // 质押池 PDA 地址
    rewardVaultPda, // 奖励金库 PDA 地址
    poolQuery, // 质押池查询
    initialize, // 初始化质押池
    updateRewardRate, // 更新奖励率
    fundRewards, // 向奖励池注资
    pause, // 暂停程序
    unpause, // 恢复程序
    updateLockupDuration, // 更新锁定期时长
    burnRewardTokens, // 销毁奖励代币
    changeAdmin, // 更改管理员
    emergencyWithdrawStakedTokens, // 紧急提取质押代币
    emergencyWithdrawRewardTokens, // 紧急提取奖励代币
  }
}

/**
 * Hook，用于管理当前连接钱包用户的特定质押信息和操作。
 */
export function useUserStakeInfo() {
  // 获取 Solana 网络连接
  const { connection } = useConnection()
  // 获取当前集群（网络）信息
  const { cluster } = useCluster()
  // 获取交易 Toast 通知工具
  const transactionToast = useTransactionToast()
  // 获取 Anchor 提供者
  const provider = useAnchorProvider()
  // 获取当前连接钱包的公钥
  const { publicKey } = useWallet()
  // 从 useStakingProgram 获取程序、程序 ID、质押池 PDA 和质押池查询
  const { program, programId, poolPda, poolQuery } = useStakingProgram()
  // 获取 Tanstack Query 的客户端实例
  const queryClient = useQueryClient()

  // 派生用户特定的质押信息 PDA 地址
  const userStakeInfoPda = useMemo(() => {
    // 检查钱包公钥是否有效
    if (!publicKey) return
    // 使用 'stake_info' 和用户公钥作为种子计算 PDA
    return PublicKey.findProgramAddressSync([Buffer.from('stake_info'), publicKey.toBuffer()], programId)[0]
  }, [programId, publicKey])

  // 查询用户的质押信息账户
  const userStakeInfoQuery = useQuery({
    // 定义查询的唯一 key
    queryKey: ['staking', 'userStakeInfo', { cluster, userStakeInfoPda }],
    // 查询函数，异步获取用户质押信息
    queryFn: async () => {
      // 如果用户质押信息 PDA 无效，返回 null
      if (!userStakeInfoPda) return null
      try {
        // 尝试获取用户质押信息账户数据
        return await program.account.userStakeInfo.fetch(userStakeInfoPda)
      } catch (e) {
        // 如果账户不存在，表示用户尚未质押
        return null
      }
    },
    // 仅当公钥和用户质押信息 PDA 有效时启用查询
    enabled: !!publicKey && !!userStakeInfoPda,
    // 每 5 秒刷新一次数据
    refetchInterval: 5000,
  })

  // ---- Mutations for User Actions ----

  // 质押
  const stake = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'stake', { cluster, publicKey }],
    // mutation 函数，执行质押操作
    mutationFn: async (amount: number) => {
      // 检查钱包、用户质押信息 PDA 和质押池数据是否有效
      if (!publicKey || !userStakeInfoPda || !poolQuery.data) {
        throw new Error('User or pool not loaded')
      }

      // 获取质押代币 Mint 地址
      const stakingMint = poolQuery.data.stakingMint
      // 计算用户的质押代币关联账户（ATA）地址
      const userStakingWallet = getAssociatedTokenAddressSync(stakingMint, publicKey, false, TOKEN_2022_PROGRAM_ID)
      // 计算质押金库的 PDA 地址
      const stakingVault = PublicKey.findProgramAddressSync([Buffer.from('staking_vault')], programId)[0]
      // 获取奖励代币的 decimals
      const decimals = await connection.getTokenSupply(poolQuery.data.rewardMint).then((res) => res.value.decimals)

      // 将输入金额转换为字符串
      const amountString = amount.toString()
      // 分离整数和小数部分
      const [integerPartStr, fractionalPartStr = ''] = amountString.split('.')
      // 创建 BN 实例表示 10
      const ten = new BN(10)
      // 创建 BN 实例表示 decimals
      const decimalsBN = new BN(decimals)
      // 计算 10^decimals 的乘数
      const multiplier = ten.pow(decimalsBN)
      // 将整数部分转换为 BN 并乘以乘数
      const integerPartBN = new BN(integerPartStr).mul(multiplier)
      // 处理小数部分，截取并补零
      const fractionalPartPadded = fractionalPartStr.slice(0, decimals).padEnd(decimals, '0')
      // 将小数部分转换为 BN
      const fractionalPartBN = new BN(fractionalPartPadded)
      // 计算最终的链上金额
      const scaledAmount = integerPartBN.add(fractionalPartBN)

      // 初始化指令数组
      const instructions = []
      // 检查用户质押代币账户是否存在
      const accountInfo = await connection.getAccountInfo(userStakingWallet)

      // 如果账户不存在，添加创建关联代币账户的指令
      if (!accountInfo) {
        // 显示创建账户的提示
        toast.info('Creating token account for you...')
        instructions.push(
          createAssociatedTokenAccountInstruction(
            publicKey, // 支付者
            userStakingWallet, // ATA 地址
            publicKey, // 账户所有者
            stakingMint, // 质押代币 Mint
            TOKEN_2022_PROGRAM_ID, // SPL Token 程序
          ),
        )
      }

      // 调用程序的 stake 方法
      return program.methods
        .stake(scaledAmount)
        .accounts({
          user: publicKey, // 用户公钥
          pool: poolPda, // 质押池账户
          userStakeInfo: userStakeInfoPda, // 用户质押信息账户
          userStakingWallet: userStakingWallet, // 用户的质押代币 ATA
          stakingVault: stakingVault, // 质押金库
          stakingMint: stakingMint, // 质押代币 Mint
          systemProgram: SystemProgram.programId, // 系统程序
          tokenProgram: TOKEN_2022_PROGRAM_ID, // SPL Token 程序
        })
        .preInstructions(instructions) // 添加预备指令（如果需要）
        .rpc() // 发送交易到链上
    },
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示
      toast.success('Stake successful!')
      // 刷新用户质押信息查询
      userStakeInfoQuery.refetch()
      // 刷新质押池查询
      poolQuery.refetch()
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Stake failed: ${err.message}`)
    },
  })

  // 取消质押
  const unstake = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'unstake', { cluster, publicKey }],
    // mutation 函数，执行取消质押操作
    mutationFn: async (amount: number) => {
      // 检查钱包、用户质押信息 PDA 和质押池数据是否有效
      if (!publicKey || !userStakeInfoPda || !poolQuery.data) throw new Error('User or pool not loaded')

      // 计算用户的质押代币关联账户（ATA）地址
      const userStakingWallet = getAssociatedTokenAddressSync(
        poolQuery.data.stakingMint,
        publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      )
      // 计算质押金库的 PDA 地址
      const stakingVault = PublicKey.findProgramAddressSync([Buffer.from('staking_vault')], programId)[0]
      // 获取奖励代币的 decimals
      const decimals = await connection.getTokenSupply(poolQuery.data.rewardMint).then((res) => res.value.decimals)

      // 将输入金额转换为字符串
      const amountString = amount.toString()
      // 分离整数和小数部分
      const [integerPartStr, fractionalPartStr = ''] = amountString.split('.')
      // 创建 BN 实例表示 10
      const ten = new BN(10)
      // 创建 BN 实例表示 decimals
      const decimalsBN = new BN(decimals)
      // 计算 10^decimals 的乘数
      const multiplier = ten.pow(decimalsBN)
      // 将整数部分转换为 BN 并乘以乘数
      const integerPartBN = new BN(integerPartStr).mul(multiplier)
      // 处理小数部分，截取并补零
      const fractionalPartPadded = fractionalPartStr.slice(0, decimals).padEnd(decimals, '0')
      // 将小数部分转换为 BN
      const fractionalPartBN = new BN(fractionalPartPadded)
      // 计算最终的链上金额
      const scaledAmount = integerPartBN.add(fractionalPartBN)

      // 调用程序的 unstake 方法
      return program.methods
        .unstake(scaledAmount)
        .accounts({
          user: publicKey, // 用户公钥
          pool: poolPda, // 质押池账户
          userStakeInfo: userStakeInfoPda, // 用户质押信息账户
          userStakingWallet: userStakingWallet, // 用户的质押代币 ATA
          stakingVault: stakingVault, // 质押金库
          stakingMint: poolQuery.data.stakingMint, // 质押代币 Mint
          tokenProgram: TOKEN_2022_PROGRAM_ID, // SPL Token 程序
        })
        .rpc() // 发送交易到链上
    },
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示
      toast.success('Unstake successful!')
      // 刷新用户质押信息查询
      userStakeInfoQuery.refetch()
      // 刷新质押池查询
      poolQuery.refetch()
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Unstake failed: ${err.message}`)
    },
  })

  // 领取奖励
  const claimRewards = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'claimRewards', { cluster, publicKey }],
    // mutation 函数，执行领取奖励操作
    mutationFn: async () => {
      // 检查钱包、用户质押信息 PDA 和质押池数据是否有效
      if (!publicKey || !userStakeInfoPda || !poolQuery.data) {
        throw new Error('User or pool not loaded')
      }

      // 获取奖励代币 Mint 地址
      const rewardMint = poolQuery.data.rewardMint
      // 计算用户的奖励代币关联账户（ATA）地址
      const userRewardWallet = getAssociatedTokenAddressSync(rewardMint, publicKey, false, TOKEN_2022_PROGRAM_ID)
      // 计算奖励金库的 PDA 地址
      const rewardVault = PublicKey.findProgramAddressSync([Buffer.from('reward_vault')], programId)[0]

      // 初始化指令数组
      const instructions = []
      // 检查用户奖励代币账户是否存在
      const accountInfo = await connection.getAccountInfo(userRewardWallet)

      // 如果账户不存在，添加创建关联代币账户的指令
      if (!accountInfo) {
        // 显示创建账户的提示
        toast.info('Creating reward token account for you...')
        instructions.push(
          createAssociatedTokenAccountInstruction(
            publicKey, // 支付者
            userRewardWallet, // ATA 地址
            publicKey, // 账户所有者
            rewardMint, // 奖励代币 Mint
            TOKEN_2022_PROGRAM_ID, // SPL Token 程序
          ),
        )
      }

      // 调用程序的 claimRewards 方法
      return program.methods
        .claimRewards()
        .accounts({
          user: publicKey, // 用户公钥
          pool: poolPda, // 质押池账户
          userStakeInfo: userStakeInfoPda, // 用户质押信息账户
          userRewardWallet: userRewardWallet, // 用户的奖励代币 ATA
          rewardVault: rewardVault, // 奖励金库
          rewardMint: rewardMint, // 奖励代币 Mint
          tokenProgram: TOKEN_2022_PROGRAM_ID, // SPL Token 程序
        })
        .preInstructions(instructions) // 添加预备指令（如果需要）
        .rpc() // 发送交易到链上
    },
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示
      toast.success('Rewards claimed successfully!')
      // 刷新用户质押信息查询
      userStakeInfoQuery.refetch()
      // 刷新质押池查询
      poolQuery.refetch()
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Claim failed: ${err.message}`)
    },
  })

  // 销毁奖励代币（用户操作）
  const burnRewardTokens = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'burnRewardTokens', { cluster, publicKey }],
    // mutation 函数，执行销毁奖励代币的链上操作
    mutationFn: async (amount: number) => {
      // 检查钱包和奖励代币 Mint 是否有效
      if (!publicKey || !poolQuery.data?.rewardMint) {
        throw new Error('Admin wallet not connected or reward mint not found')
      }

      // 获取奖励代币 Mint 地址
      const rewardMint = poolQuery.data.rewardMint
      // 计算用户的奖励代币关联账户（ATA）地址
      const adminRewardWallet = getAssociatedTokenAddressSync(rewardMint, publicKey, false, TOKEN_2022_PROGRAM_ID)

      // 获取奖励代币的 decimals
      const decimals = await connection.getTokenSupply(rewardMint).then((res) => res.value.decimals)
      // 将输入金额转换为字符串
      const amountString = amount.toString()
      // 分离整数和小数部分
      const [integerPartStr, fractionalPartStr = ''] = amountString.split('.')
      // 创建 BN 实例表示 10
      const ten = new BN(10)
      // 创建 BN 实例表示 decimals
      const decimalsBN = new BN(decimals)
      // 计算 10^decimals 的乘数
      const multiplier = ten.pow(decimalsBN)
      // 将整数部分转换为 BN 并乘以乘数
      const integerPartBN = new BN(integerPartStr).mul(multiplier)
      // 处理小数部分，截取并补零
      const fractionalPartPadded = fractionalPartStr.slice(0, decimals).padEnd(decimals, '0')
      // 将小数部分转换为 BN
      const fractionalPartBN = new BN(fractionalPartPadded)
      // 计算最终的链上金额
      const scaledAmount = integerPartBN.add(fractionalPartBN)

      // 创建销毁代币的指令
      const burnInstruction = createBurnInstruction(
        adminRewardWallet, // 要销毁的账户（用户的奖励代币 ATA）
        rewardMint, // 奖励代币 Mint
        publicKey, // 账户所有者（用户）
        BigInt(scaledAmount.toString()), // 要销毁的代币数量
        [], // 多重签名者（无）
        TOKEN_2022_PROGRAM_ID, // SPL Token 程序
      )

      // 创建交易并添加销毁指令
      const transaction = new Transaction().add(burnInstruction)
      // 发送并确认交易
      const signature = await provider.sendAndConfirm(transaction)
      return signature
    },
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示
      toast.success('Reward tokens burned successfully!')
      // 使用户的代币余额查询失效
      queryClient.invalidateQueries({
        queryKey: ['token-balance', publicKey?.toBase58(), poolQuery.data?.rewardMint?.toBase58()],
      })
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Burn failed: ${err.message}`)
    },
  })

  // 关闭用户质押信息账户
  const closeUserStakeInfo = useMutation({
    // 定义 mutation 的唯一 key
    mutationKey: ['staking', 'closeUserStakeInfo', { cluster, publicKey }],
    // mutation 函数，执行关闭用户质押信息账户的链上操作
    mutationFn: async () => {
      // 检查钱包和用户质押信息 PDA 是否有效
      if (!publicKey || !userStakeInfoPda) {
        throw new Error('Wallet not connected or user stake info PDA not found')
      }

      // 调用程序的 closeUserStakeInfo 方法
      return program.methods
        .closeUserStakeInfo()
        .accounts({
          user: publicKey, // 用户公钥
          userStakeInfo: userStakeInfoPda, // 用户质押信息账户
        })
        .rpc() // 发送交易到链上
    },
    // 成功时的回调
    onSuccess: (signature) => {
      // 显示交易成功的 Toast 通知
      transactionToast(signature)
      // 显示成功提示
      toast.success('Stake account closed successfully!')
      // 使用户质押信息查询失效
      queryClient.invalidateQueries({ queryKey: ['staking', 'userStakeInfo', { cluster, userStakeInfoPda }] })
    },
    // 失败时的回调
    onError: (err: Error) => {
      // 显示错误提示
      toast.error(`Failed to close account: ${err.message}`)
    },
  })

  // 返回所有相关数据和方法
  return {
    userStakeInfoQuery, // 用户质押信息查询
    stake, // 质押
    unstake, // 取消质押
    claimRewards, // 领取奖励
    burnRewardTokens, // 销毁奖励代币
    closeUserStakeInfo, // 关闭用户质押信息账户
  }
}

/**
 * 一个可重用的 Hook，用于查询指定 Mint 地址的代币余额。
 * @param mintPublicKey - 要查询余额的代币 Mint 地址。
 * @returns 包含余额信息和加载状态的 useQuery 对象。
 */
export function useTokenBalance(mintPublicKey?: PublicKey) {
  // 获取 Solana 网络连接
  const { connection } = useConnection()
  // 获取当前连接钱包的公钥
  const { publicKey } = useWallet()

  // 查询代币余额
  const query = useQuery({
    // 定义查询的唯一 key，包含钱包公钥和代币 Mint 公钥
    queryKey: ['token-balance', publicKey?.toBase58(), mintPublicKey?.toBase58()],
    // 查询函数，异步获取代币余额
    queryFn: async () => {
      // 如果钱包或 Mint 地址无效，返回 null
      if (!publicKey || !mintPublicKey) {
        return null
      }

      try {
        // 计算关联代币账户（ATA）地址
        const ata = getAssociatedTokenAddressSync(mintPublicKey, publicKey, false, TOKEN_2022_PROGRAM_ID)
        // 获取代币账户余额
        const balance = await connection.getTokenAccountBalance(ata)
        // 返回格式化后的余额信息
        return {
          amount: balance.value.uiAmount, // 用户友好的余额（带小数）
          amountRaw: balance.value.amount, // 原始余额（无小数）
          decimals: balance.value.decimals, // 代币的小数位数
        }
      } catch (e) {
        // 如果账户不存在或发生错误，返回余额为 0
        console.log(`Could not get balance for mint ${mintPublicKey.toBase58()}:`, e)
        return { amount: 0, amountRaw: '0', decimals: 0 }
      }
    },
    // 仅当钱包公钥和 Mint 地址有效时启用查询
    enabled: !!publicKey && !!mintPublicKey,
    // 每 10 秒刷新一次余额
    refetchInterval: 10000,
  })

  // 返回查询结果
  return query
}
