// 导入 Anchor 框架的所有功能，用于与 Solana 程序交互
import * as anchor from '@coral-xyz/anchor'

// 导入 Anchor 的 Program 类，用于操作 Solana 程序
import { Program } from '@coral-xyz/anchor'

// 导入质押程序的类型定义，来自编译后的 IDL 文件
import { StakingProgram } from '../target/types/staking_program'

// 导入 Solana web3.js 库的必要组件，包括密钥对、公钥、系统程序和 SOL 单位常量
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'

// 导入 SPL Token 2022 程序的功能，用于创建和管理代币账户
import { createMint, createAccount, mintTo, getAccount, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'

// 导入 BN.js 库，用于处理大整数运算（Solana 中常用）
import { BN } from 'bn.js'

// 定义一个辅助函数 sleep，返回一个 Promise，延迟指定毫秒数后解析
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// 定义测试套件，名为 "staking_program"，包含所有测试用例
describe('staking_program', () => {
  // --- 设置测试环境 ---
  // 获取 Anchor 的测试环境提供者（通常是本地网络或测试网络）
  const provider = anchor.AnchorProvider.env()
  // 设置 Anchor 的提供者，用于后续程序交互
  anchor.setProvider(provider)
  // 从工作空间加载质押程序实例，类型为 stakingProgram
  const program = anchor.workspace.StakingProgram as Program<StakingProgram>
  // 获取提供者的连接对象，用于与 Solana 网络交互
  const connection = provider.connection

  // --- 定义测试账户 ---
  // 声明管理员账户的密钥对（稍后生成）
  let admin: Keypair
  // 声明用户账户的密钥对（稍后生成）
  let user: Keypair
  // 声明新管理员账户的密钥对（用于测试管理员更换）
  let newAdmin: Keypair
  // 声明未授权用户的密钥对（用于测试权限）
  let unauthorizedUser: Keypair

  // --- 定义代币和账户 ---
  // 声明质押代币的 Mint 地址
  let stakingMint: PublicKey
  // 声明奖励代币的 Mint 地址
  let rewardMint: PublicKey
  // 声明管理员的质押代币账户
  let adminStakingWallet: PublicKey
  // 声明管理员的奖励代币账户
  let adminRewardWallet: PublicKey
  // 声明用户的质押代币账户
  let userStakingWallet: PublicKey
  // 声明用户的奖励代币账户
  let userRewardWallet: PublicKey
  // 声明未授权用户的奖励代币账户
  let unauthorizedUserRewardWallet: PublicKey

  // --- 定义 PDA 地址 ---
  // 声明质押池的 PDA（程序派生地址）
  let poolPda: PublicKey
  // 声明质押代币金库的 PDA
  let stakingVaultPda: PublicKey
  // 声明奖励代币金库的 PDA
  let rewardVaultPda: PublicKey
  // 声明用户质押信息的 PDA
  let userStakeInfoPda: PublicKey

  // --- 定义测试参数 ---
  // 定义奖励速率（每秒 100 个最小单位）
  const REWARD_RATE = new BN(100)
  // 定义锁定期（2 秒）
  const LOCKUP_DURATION = new BN(2)
  // 定义质押数量（1000 个代币）
  const STAKE_AMOUNT = new BN(1000)
  // 定义注资数量（50000 个代币）
  const FUND_AMOUNT = new BN(50000)

  // --- 在所有测试开始前执行一次的设置 ---
  beforeAll(async () => {
    // 生成管理员的密钥对
    admin = Keypair.generate()
    // 生成用户的密钥对
    user = Keypair.generate()
    // 生成新管理员的密钥对
    newAdmin = Keypair.generate()
    // 生成未授权用户的密钥对
    unauthorizedUser = Keypair.generate()

    // 为所有账户空投 2 SOL，用于支付交易费用
    await Promise.all([
      connection.requestAirdrop(admin.publicKey, 2 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(newAdmin.publicKey, 2 * LAMPORTS_PER_SOL),
      connection.requestAirdrop(unauthorizedUser.publicKey, 2 * LAMPORTS_PER_SOL),
    ])

    // 等待 500 毫秒，确保空投交易确认
    await sleep(500)

    // 创建质押代币和奖励代币的 Mint（精度为 6）
    ;[stakingMint, rewardMint] = await Promise.all([
      createMint(connection, admin, admin.publicKey, null, 6, undefined, undefined, TOKEN_2022_PROGRAM_ID),
      createMint(connection, admin, admin.publicKey, null, 6, undefined, undefined, TOKEN_2022_PROGRAM_ID),
    ])

    // 为管理员和用户创建代币账户
    ;[adminStakingWallet, adminRewardWallet, userStakingWallet, userRewardWallet, unauthorizedUserRewardWallet] =
      await Promise.all([
        // 创建管理员的质押代币账户
        createAccount(connection, admin, stakingMint, admin.publicKey, undefined, undefined, TOKEN_2022_PROGRAM_ID),
        // 创建管理员的奖励代币账户
        createAccount(connection, admin, rewardMint, admin.publicKey, undefined, undefined, TOKEN_2022_PROGRAM_ID),
        // 创建用户的质押代币账户
        createAccount(connection, user, stakingMint, user.publicKey, undefined, undefined, TOKEN_2022_PROGRAM_ID),
        // 创建用户的奖励代币账户
        createAccount(connection, user, rewardMint, user.publicKey, undefined, undefined, TOKEN_2022_PROGRAM_ID),
        // 创建未授权用户的奖励代币账户
        createAccount(
          connection,
          unauthorizedUser,
          rewardMint,
          unauthorizedUser.publicKey,
          undefined,
          undefined,
          TOKEN_2022_PROGRAM_ID,
        ),
      ])

    // 给用户分发质押代币（2 倍质押量），给管理员分发奖励代币（2 倍注资量）
    await Promise.all([
      mintTo(
        connection,
        admin,
        stakingMint,
        userStakingWallet,
        admin,
        STAKE_AMOUNT.toNumber() * 2,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID,
      ),
      mintTo(
        connection,
        admin,
        rewardMint,
        adminRewardWallet,
        admin,
        FUND_AMOUNT.toNumber() * 2,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID,
      ),
    ])

    // 派生质押池的 PDA 地址，使用种子 "pool"
    ;[poolPda] = PublicKey.findProgramAddressSync([Buffer.from('pool')], program.programId)
    // 派生质押金库的 PDA 地址，使用种子 "staking_vault"
    ;[stakingVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('staking_vault')], program.programId)
    // 派生奖励金库的 PDA 地址，使用种子 "reward_vault"
    ;[rewardVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('reward_vault')], program.programId)
    // 派生用户质押信息的 PDA 地址，使用种子 "stake_info" 和用户公钥
    ;[userStakeInfoPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('stake_info'), user.publicKey.toBuffer()],
      program.programId,
    )
  })

  // --- 测试套件：初始化 ---
  describe('Initialization', () => {
    // 测试用例：验证质押池是否能正确初始化
    it('should initialize the staking pool correctly', async () => {
      // 调用程序的 initialize 方法，设置奖励速率和锁定期
      await program.methods
        .initialize(REWARD_RATE, LOCKUP_DURATION)
        .accounts({
          // 质押池账户
          pool: poolPda,
          // 管理员公钥
          admin: admin.publicKey,
          // 质押代币的 Mint
          stakingMint: stakingMint,
          // 质押金库账户
          stakingVault: stakingVaultPda,
          // 奖励代币的 Mint
          rewardMint: rewardMint,
          // 奖励金库账户
          rewardVault: rewardVaultPda,
          // 系统程序
          systemProgram: SystemProgram.programId,
          // SPL Token 程序
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          // 租金系统变量
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        // 管理员签名交易
        .signers([admin])
        // 发送交易并等待确认
        .rpc()

      // 获取质押池账户数据
      const poolAccount = await program.account.pool.fetch(poolPda)
      // 获取质押金库账户信息
      const stakingVaultAccount = await getAccount(connection, stakingVaultPda, undefined, TOKEN_2022_PROGRAM_ID)
      // 获取奖励金库账户信息
      const rewardVaultAccount = await getAccount(connection, rewardVaultPda, undefined, TOKEN_2022_PROGRAM_ID)

      // 验证质押池的管理员地址
      expect(poolAccount.admin.toBase58()).toBe(admin.publicKey.toBase58())
      // 验证质押代币的 Mint 地址
      expect(poolAccount.stakingMint.toBase58()).toBe(stakingMint.toBase58())
      // 验证奖励代币的 Mint 地址
      expect(poolAccount.rewardMint.toBase58()).toBe(rewardMint.toBase58())
      // 验证奖励速率
      expect(poolAccount.rewardRate.toString()).toBe(REWARD_RATE.toString())
      // 验证锁定期
      expect(poolAccount.lockupDuration.toString()).toBe(LOCKUP_DURATION.toString())
      // 验证初始总质押量为 0
      expect(poolAccount.totalStaked.toString()).toBe('0')
      // 验证程序未暂停
      expect(poolAccount.isPaused).toBe(false)
      // 验证质押金库的所有者是质押池 PDA
      expect(stakingVaultAccount.owner.toBase58()).toBe(poolPda.toBase58())
      // 验证奖励金库的所有者是质押池 PDA
      expect(rewardVaultAccount.owner.toBase58()).toBe(poolPda.toBase58())
    })
  })

  // --- 测试套件：用户操作 ---
  describe('User Actions', () => {
    // 在用户操作测试前，为奖励池注资
    beforeAll(async () => {
      // 调用程序的 fundRewards 方法，向奖励金库注入代币
      await program.methods
        .fundRewards(FUND_AMOUNT)
        .accounts({
          // 质押池账户
          pool: poolPda,
          // 管理员公钥
          admin: admin.publicKey,
          // 管理员的奖励代币账户
          funderWallet: adminRewardWallet,
          // 奖励金库账户
          rewardVault: rewardVaultPda,
          // 奖励代币的 Mint
          rewardMint: rewardMint,
          // SPL Token 程序
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        // 管理员签名交易
        .signers([admin])
        // 发送交易并等待确认
        .rpc()
    })

    // 测试用例：验证用户可以成功质押代币
    it('should allow a user to stake tokens', async () => {
      // 获取用户质押代币账户的初始状态
      const userWalletBefore = await getAccount(connection, userStakingWallet, undefined, TOKEN_2022_PROGRAM_ID)
      // 获取质押金库的初始状态
      const vaultBefore = await getAccount(connection, stakingVaultPda, undefined, TOKEN_2022_PROGRAM_ID)

      // 调用程序的 stake 方法，质押指定数量的代币
      await program.methods
        .stake(STAKE_AMOUNT)
        .accounts({
          // 用户公钥
          user: user.publicKey,
          // 质押池账户
          pool: poolPda,
          // 用户质押信息账户
          userStakeInfo: userStakeInfoPda,
          // 用户的质押代币账户
          userStakingWallet: userStakingWallet,
          // 质押金库账户
          stakingVault: stakingVaultPda,
          // 质押代币的 Mint
          stakingMint: stakingMint,
          // 系统程序
          systemProgram: SystemProgram.programId,
          // SPL Token 程序
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        // 用户签名交易
        .signers([user])
        // 发送交易并等待确认
        .rpc()

      // 获取用户质押代币账户的最终状态
      const userWalletAfter = await getAccount(connection, userStakingWallet, undefined, TOKEN_2022_PROGRAM_ID)
      // 获取质押金库的最终状态
      const vaultAfter = await getAccount(connection, stakingVaultPda, undefined, TOKEN_2022_PROGRAM_ID)
      // 获取质押池账户数据
      const poolAccount = await program.account.pool.fetch(poolPda)
      // 获取用户质押信息账户数据
      const userStakeInfo = await program.account.userStakeInfo.fetch(userStakeInfoPda)

      // 验证用户账户代币减少了质押数量
      expect(Number(userWalletAfter.amount)).toBe(Number(userWalletBefore.amount) - STAKE_AMOUNT.toNumber())
      // 验证质押金库代币增加了质押数量
      expect(Number(vaultAfter.amount)).toBe(Number(vaultBefore.amount) + STAKE_AMOUNT.toNumber())
      // 验证质押池的总质押量
      expect(poolAccount.totalStaked.toString()).toBe(STAKE_AMOUNT.toString())
      // 验证用户质押信息中的质押数量
      expect(userStakeInfo.stakeAmount.toString()).toBe(STAKE_AMOUNT.toString())
      // 验证质押开始时间戳大于 0
      expect(userStakeInfo.stakeStartTimestamp.toNumber()).toBeGreaterThan(0)
    })

    // 测试用例：验证质押 0 个代币会失败
    it('should fail to stake zero tokens', async () => {
      // 期望调用 stake 方法（质押 0 个代币）会抛出错误
      await expect(
        program.methods
          .stake(new BN(0))
          .accounts({
            // 用户公钥
            user: user.publicKey,
            // 质押池账户
            pool: poolPda,
            // 用户质押信息账户
            userStakeInfo: userStakeInfoPda,
            // 用户的质押代币账户
            userStakingWallet: userStakingWallet,
            // 质押金库账户
            stakingVault: stakingVaultPda,
            // 质押代币的 Mint
            stakingMint: stakingMint,
            // 系统程序
            systemProgram: SystemProgram.programId,
            // SPL Token 程序
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          // 用户签名交易
          .signers([user])
          // 发送交易
          .rpc(),
      ).rejects.toThrow(/ZeroStakeAmount/) // 期望抛出 ZeroStakeAmount 错误
    })

    // 测试用例：验证在锁定期结束前无法取消质押
    it('should fail to unstake before lockup period ends', async () => {
      // 期望调用 unstake 方法会抛出错误（因为锁定期未结束）
      await expect(
        program.methods
          .unstake(STAKE_AMOUNT)
          .accounts({
            // 用户公钥
            user: user.publicKey,
            // 质押池账户
            pool: poolPda,
            // 用户质押信息账户
            userStakeInfo: userStakeInfoPda,
            // 用户的质押代币账户
            userStakingWallet: userStakingWallet,
            // 质押金库账户
            stakingVault: stakingVaultPda,
            // 质押代币的 Mint
            stakingMint: stakingMint,
            // SPL Token 程序
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          // 用户签名交易
          .signers([user])
          // 发送交易
          .rpc(),
      ).rejects.toThrow(/LockupPeriodNotEnded/) // 期望抛出 LockupPeriodNotEnded 错误
    })

    // 测试用例：验证用户可以领取累积的奖励
    it('should allow a user to claim accrued rewards', async () => {
      // 等待锁定期+1秒，确保奖励累积
      await sleep((LOCKUP_DURATION.toNumber() + 1) * 1000)

      // 获取用户奖励代币账户的初始状态
      const userRewardWalletBefore = await getAccount(connection, userRewardWallet, undefined, TOKEN_2022_PROGRAM_ID)

      // 调用程序的 claimRewards 方法，领取奖励
      await program.methods
        .claimRewards()
        .accounts({
          // 用户公钥
          user: user.publicKey,
          // 质押池账户
          pool: poolPda,
          // 用户质押信息账户
          userStakeInfo: userStakeInfoPda,
          // 用户的奖励代币账户
          userRewardWallet: userRewardWallet,
          // 奖励金库账户
          rewardVault: rewardVaultPda,
          // 奖励代币的 Mint
          rewardMint: rewardMint,
          // SPL Token 程序
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        // 用户签名交易
        .signers([user])
        // 发送交易并等待确认
        .rpc()

      // 获取用户奖励代币账户的最终状态
      const userRewardWalletAfter = await getAccount(connection, userRewardWallet, undefined, TOKEN_2022_PROGRAM_ID)
      // 获取用户质押信息账户数据
      const userStakeInfo = await program.account.userStakeInfo.fetch(userStakeInfoPda)

      // 验证用户奖励代币增加
      expect(Number(userRewardWalletAfter.amount)).toBeGreaterThan(Number(userRewardWalletBefore.amount))
      // 验证用户质押信息中的奖励清零
      expect(userStakeInfo.rewards.toString()).toBe('0')
    })

    // 测试用例：验证无奖励可领取时会失败
    it('should fail to claim when there are no rewards', async () => {
      // 期望调用 claimRewards 方法会抛出错误（因为刚领取过奖励）
      await expect(
        program.methods
          .claimRewards()
          .accounts({
            // 用户公钥
            user: user.publicKey,
            // 质押池账户
            pool: poolPda,
            // 用户质押信息账户
            userStakeInfo: userStakeInfoPda,
            // 用户的奖励代币账户
            userRewardWallet: userRewardWallet,
            // 奖励金库账户
            rewardVault: rewardVaultPda,
            // 奖励代币的 Mint
            rewardMint: rewardMint,
            // SPL Token 程序
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          // 用户签名交易
          .signers([user])
          // 发送交易
          .rpc(),
      ).rejects.toThrow(/NoRewardsToClaim/) // 期望抛出 NoRewardsToClaim 错误
    })

    // 测试用例：验证锁定期结束后用户可以取消质押
    it('should allow a user to unstake tokens after lockup period', async () => {
      // 获取用户质押代币账户的初始状态
      const userWalletBefore = await getAccount(connection, userStakingWallet, undefined, TOKEN_2022_PROGRAM_ID)

      // 调用程序的 unstake 方法，取消质押
      await program.methods
        .unstake(STAKE_AMOUNT)
        .accounts({
          // 用户公钥
          user: user.publicKey,
          // 质押池账户
          pool: poolPda,
          // 用户质押信息账户
          userStakeInfo: userStakeInfoPda,
          // 用户的质押代币账户
          userStakingWallet: userStakingWallet,
          // 质押金库账户
          stakingVault: stakingVaultPda,
          // 质押代币的 Mint
          stakingMint: stakingMint,
          // SPL Token 程序
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        // 用户签名交易
        .signers([user])
        // 发送交易并等待确认
        .rpc()

      // 获取用户质押代币账户的最终状态
      const userWalletAfter = await getAccount(connection, userStakingWallet, undefined, TOKEN_2022_PROGRAM_ID)
      // 获取质押池账户数据
      const poolAccount = await program.account.pool.fetch(poolPda)
      // 获取用户质押信息账户数据
      const userStakeInfo = await program.account.userStakeInfo.fetch(userStakeInfoPda)

      // 验证用户账户代币增加了质押数量
      expect(Number(userWalletAfter.amount)).toBe(Number(userWalletBefore.amount) + STAKE_AMOUNT.toNumber())
      // 验证质押池的总质押量清零
      expect(poolAccount.totalStaked.toString()).toBe('0')
      // 验证用户质押信息中的质押数量清零
      expect(userStakeInfo.stakeAmount.toString()).toBe('0')
    })

    // 测试用例：验证用户可以关闭空的质押信息账户
    it('should allow user to close their stake info account when empty', async () => {
      // 获取用户质押信息账户数据
      const info = await program.account.userStakeInfo.fetch(userStakeInfoPda)
      // 验证质押数量为 0
      expect(info.stakeAmount.toString()).toBe('0')

      // 如果有剩余奖励，先领取
      if (info.rewards.toNumber() > 0) {
        // 调用程序的 claimRewards 方法，领取剩余奖励
        await program.methods
          .claimRewards()
          .accounts({
            // 用户公钥
            user: user.publicKey,
            // 质押池账户
            pool: poolPda,
            // 用户质押信息账户
            userStakeInfo: userStakeInfoPda,
            // 用户的奖励代币账户
            userRewardWallet: userRewardWallet,
            // 奖励金库账户
            rewardVault: rewardVaultPda,
            // 奖励代币的 Mint
            rewardMint: rewardMint,
            // SPL Token 程序
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          // 用户签名交易
          .signers([user])
          // 发送交易并等待确认
          .rpc()
      }

      // 获取用户余额（SOL）的初始状态
      const userBalanceBefore = await connection.getBalance(user.publicKey)

      // 调用程序的 closeUserStakeInfo 方法，关闭用户质押信息账户
      await program.methods
        .closeUserStakeInfo()
        .accounts({
          // 用户公钥
          user: user.publicKey,
          // 用户质押信息账户
          userStakeInfo: userStakeInfoPda,
        })
        // 用户签名交易
        .signers([user])
        // 发送交易并等待确认
        .rpc()

      // 获取用户余额（SOL）的最终状态
      const userBalanceAfter = await connection.getBalance(user.publicKey)
      // 检查质押信息账户是否已关闭
      const closedAccountInfo = await connection.getAccountInfo(userStakeInfoPda)
      // 验证账户已关闭（返回 null）
      expect(closedAccountInfo).toBeNull()
      // 验证租金已返还，用户余额增加
      expect(userBalanceAfter).toBeGreaterThan(userBalanceBefore)
    })
  })

  // --- 测试套件：管理员操作 ---
  describe('Admin Actions', () => {
    // 测试用例：验证管理员可以更改奖励速率
    it('should allow admin to change the reward rate', async () => {
      // 定义新的奖励速率（200）
      const NEW_RATE = new BN(200)
      // 调用程序的 updateRewardRate 方法
      await program.methods
        .updateRewardRate(NEW_RATE)
        .accounts({
          // 质押池账户
          pool: poolPda,
          // 管理员公钥
          admin: admin.publicKey,
        })
        // 管理员签名交易
        .signers([admin])
        // 发送交易并等待确认
        .rpc()
      // 获取质押池账户数据
      const poolAccount = await program.account.pool.fetch(poolPda)
      // 验证奖励速率已更新
      expect(poolAccount.rewardRate.toString()).toBe(NEW_RATE.toString())
    })

    // 测试用例：验证管理员可以暂停和取消暂停程序
    it('should allow admin to pause and unpause the program', async () => {
      // 调用程序的 pause 方法，暂停程序
      await program.methods
        .pause()
        .accounts({ pool: poolPda, admin: admin.publicKey })
        // 管理员签名交易
        .signers([admin])
        // 发送交易并等待确认
        .rpc()
      // 获取质押池账户数据
      let poolAccount = await program.account.pool.fetch(poolPda)
      // 验证程序已暂停
      expect(poolAccount.isPaused).toBe(true)

      // 验证暂停后用户无法质押
      await expect(
        program.methods
          .stake(new BN(100))
          .accounts({
            // 用户公钥
            user: user.publicKey,
            // 质押池账户
            pool: poolPda,
            // 用户质押信息账户
            userStakeInfo: userStakeInfoPda,
            // 用户的质押代币账户
            userStakingWallet: userStakingWallet,
            // 质押金库账户
            stakingVault: stakingVaultPda,
            // 质押代币的 Mint
            stakingMint: stakingMint,
            // 系统程序
            systemProgram: SystemProgram.programId,
            // SPL Token 程序
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          // 用户签名交易
          .signers([user])
          // 发送交易
          .rpc(),
      ).rejects.toThrow(/ProgramPaused/) // 期望抛出 ProgramPaused 错误

      // 调用程序的 unpause 方法，取消暂停
      await program.methods
        .unpause()
        .accounts({ pool: poolPda, admin: admin.publicKey })
        // 管理员签名交易
        .signers([admin])
        // 发送交易并等待确认
        .rpc()
      // 获取质押池账户数据
      poolAccount = await program.account.pool.fetch(poolPda)
      // 验证程序已取消暂停
      expect(poolAccount.isPaused).toBe(false)
    })

    // 测试用例：验证管理员可以更换管理员公钥
    it('should allow admin to change the admin key', async () => {
      // 调用程序的 changeAdmin 方法，更换管理员
      await program.methods
        .changeAdmin(newAdmin.publicKey)
        .accounts({ pool: poolPda, admin: admin.publicKey })
        // 原管理员签名交易
        .signers([admin])
        // 发送交易并等待确认
        .rpc()

      // 获取质押池账户数据
      const poolAccount = await program.account.pool.fetch(poolPda)
      // 验证新管理员公钥已设置
      expect(poolAccount.admin.toBase58()).toBe(newAdmin.publicKey.toBase58())

      // 验证旧管理员无法再执行管理员操作
      await expect(
        program.methods.pause().accounts({ pool: poolPda, admin: admin.publicKey }).signers([admin]).rpc(),
      ).rejects.toThrow() // 期望抛出 has_one 约束错误

      // 验证新管理员可以执行管理员操作
      await program.methods
        .pause()
        .accounts({ pool: poolPda, admin: newAdmin.publicKey })
        // 新管理员签名交易
        .signers([newAdmin])
        // 发送交易并等待确认
        .rpc()

      // 恢复程序状态（取消暂停），方便后续测试
      await program.methods
        .unpause()
        .accounts({ pool: poolPda, admin: newAdmin.publicKey })
        // 新管理员签名交易
        .signers([newAdmin])
        // 发送交易并等待确认
        .rpc()
    })

    // 测试用例：验证非管理员无法执行管理员操作
    it('should fail if a non-admin tries an admin action', async () => {
      // 期望未授权用户调用 updateRewardRate 方法会失败
      await expect(
        program.methods
          .updateRewardRate(new BN(999))
          .accounts({
            // 质押池账户
            pool: poolPda,
            // 未授权用户公钥
            admin: unauthorizedUser.publicKey,
          })
          // 未授权用户签名交易
          .signers([unauthorizedUser])
          // 发送交易
          .rpc(),
      ).rejects.toThrow() // 期望抛出 has_one 约束错误
    })

    // 测试用例：验证管理员可以紧急提取奖励代币
    it('should allow admin to perform an emergency withdrawal of reward tokens', async () => {
      // 定义要提取的代币数量
      const amountToWithdraw = new BN(1000)
      // 获取奖励金库的初始状态
      const vaultBefore = await getAccount(connection, rewardVaultPda, undefined, TOKEN_2022_PROGRAM_ID)
      // 获取目标账户（未授权用户的奖励代币账户）的初始状态
      const destinationWalletBefore = await getAccount(
        connection,
        unauthorizedUserRewardWallet,
        undefined,
        TOKEN_2022_PROGRAM_ID,
      )

      // 调用程序的 emergencyWithdrawRewardTokens 方法，提取奖励代币
      await program.methods
        .emergencyWithdrawRewardTokens(amountToWithdraw)
        .accounts({
          // 质押池账户
          pool: poolPda,
          // 当前管理员公钥（newAdmin）
          admin: newAdmin.publicKey,
          // 奖励代币的 Mint
          rewardMint: rewardMint,
          // 奖励金库账户
          rewardVault: rewardVaultPda,
          // 目标代币账户
          destinationWallet: unauthorizedUserRewardWallet,
          // SPL Token 程序
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        // 新管理员签名交易
        .signers([newAdmin])
        // 发送交易并等待确认
        .rpc()

      // 获取奖励金库的最终状态
      const vaultAfter = await getAccount(connection, rewardVaultPda, undefined, TOKEN_2022_PROGRAM_ID)
      // 获取目标账户的最终状态
      const destinationWalletAfter = await getAccount(
        connection,
        unauthorizedUserRewardWallet,
        undefined,
        TOKEN_2022_PROGRAM_ID,
      )

      // 验证奖励金库代币减少了提取数量
      expect(Number(vaultAfter.amount)).toBe(Number(vaultBefore.amount) - amountToWithdraw.toNumber())
      // 验证目标账户代币增加了提取数量
      expect(Number(destinationWalletAfter.amount)).toBe(
        Number(destinationWalletBefore.amount) + amountToWithdraw.toNumber(),
      )
    })
  })
})
