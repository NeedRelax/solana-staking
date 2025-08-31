// 忽略 Clippy 对大型错误类型的警告，因 Anchor 的 Result 类型可能较大
#![allow(clippy::result_large_err)]

// 引入 Anchor 框架核心模块，用于账户管理、上下文处理等
use anchor_lang::prelude::*;
// 引入 Anchor SPL token 模块，支持代币相关操作
use anchor_spl::{
    token_2022::{transfer_checked, Burn, Transfer, TransferChecked},
    token_interface::{Mint, Token2022, TokenAccount},
};
// 引入 TryInto 用于类型转换
use std::convert::TryInto;

// 声明程序 ID，需替换为实际部署时的程序 ID
declare_id!("GjQvMVAgqV8UJmBdMxv2o6B3kNj7fZvw6LBctkQdFK7r");

// 定义 Anchor 程序模块，包含所有指令实现
#[program]
pub mod staking_program {
    use super::*;
    use anchor_spl::token_2022;

    // 初始化质押池，仅管理员可调用一次，设置池子参数
    pub fn initialize(
        ctx: Context<Initialize>,
        reward_rate: u64,
        lockup_duration: i64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool; // 获取池子账户可变引用
        pool.admin = ctx.accounts.admin.key(); // 设置管理员公钥
        pool.staking_mint = ctx.accounts.staking_mint.key(); // 设置质押代币 Mint 地址
        pool.staking_vault = ctx.accounts.staking_vault.key(); // 设置质押金库地址
        pool.reward_mint = ctx.accounts.reward_mint.key(); // 设置奖励代币 Mint 地址
        pool.reward_vault = ctx.accounts.reward_vault.key(); // 设置奖励金库地址
        pool.reward_rate = reward_rate; // 设置每秒奖励代币数量
        pool.last_update_timestamp = Clock::get()?.unix_timestamp; // 设置当前区块链时间戳
        pool.total_staked = 0; // 初始化总质押量为 0
        pool.reward_per_token_stored = 0; // 初始化每单位代币累计奖励为 0
        pool.pool_bump = ctx.bumps.pool; // 保存池子 PDA bump 值，用于签名验证
        pool.lockup_duration = lockup_duration; // 设置锁定期（秒）
        pool.is_paused = false; // 初始化程序为未暂停状态
        Ok(()) // 返回成功
    }

    // 用户质押代币，将代币转入金库并更新状态
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.pool.is_paused, StakingError::ProgramPaused); // 确保程序未暂停
        require_gt!(amount, 0, StakingError::ZeroStakeAmount); // 确保质押金额大于 0

        let pool = &mut ctx.accounts.pool; // 获取池子账户可变引用
        let user_stake_info = &mut ctx.accounts.user_stake_info; // 获取用户质押信息可变引用

        pool.update_rewards(Some(user_stake_info))?; // 更新全局和用户奖励，确保状态同步

        // 执行代币转账：从用户钱包到质押金库
        token_2022::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(), // 指定 SPL Token 程序
                TransferChecked {
                    from: ctx.accounts.user_staking_wallet.to_account_info(), // 用户钱包
                    mint: ctx.accounts.staking_mint.to_account_info(),
                    to: ctx.accounts.staking_vault.to_account_info(), // 质押金库
                    authority: ctx.accounts.user.to_account_info(),   // 用户签名作为权限
                },
            ),
            amount,                             // 转账金额
            ctx.accounts.staking_mint.decimals, // 关键：传入代币的小数位数
        )?;

        // 如果用户首次质押，记录开始时间
        if user_stake_info.stake_amount == 0 {
            user_stake_info.stake_start_timestamp = Clock::get()?.unix_timestamp;
        }
        // 更新用户质押金额，防止溢出
        user_stake_info.stake_amount = user_stake_info
            .stake_amount
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;
        // 更新池子总质押量，防止溢出
        pool.total_staked = pool
            .total_staked
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // 触发质押事件，记录用户公钥和金额
        emit!(StakeEvent {
            user: *ctx.accounts.user.key,
            amount
        });

        Ok(()) // 返回成功
    }

    // 用户取消质押，提取代币，需满足锁定期
    pub fn unstake(ctx: Context<UnStake>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.pool.is_paused, StakingError::ProgramPaused); // 确保程序未暂停
        require_gt!(amount, 0, StakingError::ZeroUnstakeAmount); // 确保取消质押金额大于 0

        let user_stake_info = &mut ctx.accounts.user_stake_info; // 获取用户质押信息可变引用
        require_gte!(
            user_stake_info.stake_amount,
            amount,
            StakingError::InsufficientStakeAmount
        ); // 确保质押金额足够

        let current_time = Clock::get()?.unix_timestamp; // 获取当前区块链时间
                                                         // 确保质押时间超过锁定期
        require_gte!(
            current_time,
            user_stake_info.stake_start_timestamp + ctx.accounts.pool.lockup_duration,
            StakingError::LockupPeriodNotEnded
        );

        let pool = &mut ctx.accounts.pool; // 获取池子账户可变引用
        pool.update_rewards(Some(user_stake_info))?; // 更新奖励，确保状态同步

        // 设置 PDA 签名种子，用于金库转账授权
        let pool_seeds = &[b"pool".as_ref(), &[pool.pool_bump]];
        let signer = &[&pool_seeds[..]];

        // 执行代币转账：从质押金库到用户钱包
        token_2022::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.staking_vault.to_account_info(), // 质押金库
                    mint: ctx.accounts.staking_mint.to_account_info(),
                    to: ctx.accounts.user_staking_wallet.to_account_info(), // 用户钱包
                    authority: pool.to_account_info(),                      // 池子 PDA 作为权限
                },
                signer,
            ),
            amount,
            ctx.accounts.staking_mint.decimals,
        )?;

        // 更新用户质押金额，防止溢出
        user_stake_info.stake_amount = user_stake_info
            .stake_amount
            .checked_sub(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;
        // 更新池子总质押量，防止溢出
        pool.total_staked = pool
            .total_staked
            .checked_sub(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // 如果质押金额为 0，重置开始时间
        if user_stake_info.stake_amount == 0 {
            user_stake_info.stake_start_timestamp = 0;
        }

        // 触发取消质押事件
        emit!(UnstakeEvent {
            user: *ctx.accounts.user.key,
            amount
        });

        Ok(()) // 返回成功
    }

    // 用户领取累积的奖励代币
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        require!(!ctx.accounts.pool.is_paused, StakingError::ProgramPaused); // 确保程序未暂停

        let pool = &mut ctx.accounts.pool; // 获取池子账户可变引用
        let user_stake_info = &mut ctx.accounts.user_stake_info; // 获取用户质押信息可变引用

        pool.update_rewards(Some(user_stake_info))?; // 更新奖励，累加待领奖励

        let rewards_to_claim = user_stake_info.rewards; // 获取待领取奖励金额
        require_gt!(rewards_to_claim, 0, StakingError::NoRewardsToClaim); // 确保有奖励可领
        require_gte!(
            ctx.accounts.reward_vault.amount,
            rewards_to_claim,
            StakingError::InsufficientVaultBalance
        ); // 确保金库余额足够

        // 设置 PDA 签名种子
        let pool_seeds = &[b"pool".as_ref(), &[pool.pool_bump]];
        let signer = &[&pool_seeds[..]];

        // 执行奖励代币转账：从奖励金库到用户钱包
        token_2022::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.reward_vault.to_account_info(), // 奖励金库
                    mint: ctx.accounts.reward_mint.to_account_info(),
                    to: ctx.accounts.user_reward_wallet.to_account_info(), // 用户奖励钱包
                    authority: pool.to_account_info(),                     // 池子 PDA 作为权限
                },
                signer,
            ),
            rewards_to_claim,
            ctx.accounts.reward_mint.decimals,
        )?;

        user_stake_info.rewards = 0; // 重置用户待领奖励
        emit!(ClaimEvent {
            user: *ctx.accounts.user.key,
            amount: rewards_to_claim
        }); // 触发领取奖励事件

        Ok(()) // 返回成功
    }

    // 关闭用户质押信息账户，回收租金
    pub fn close_user_stake_info(ctx: Context<CloseUserStakeInfo>) -> Result<()> {
        let user_stake_info = &ctx.accounts.user_stake_info; // 获取用户质押信息引用
        require_eq!(user_stake_info.stake_amount, 0, StakingError::StakeNotZero); // 确保质押金额为 0
        require_eq!(user_stake_info.rewards, 0, StakingError::RewardsNotClaimed); // 确保无未领奖励
                                                                                  // 账户通过 close 约束自动关闭，租金返还用户
        Ok(())
    }

    // 管理员更新奖励率
    pub fn update_reward_rate(ctx: Context<AdminAction>, new_rate: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool; // 获取池子账户可变引用
        pool.update_rewards(None)?; // 更新全局奖励，确保状态同步
        pool.reward_rate = new_rate; // 设置新奖励率
        emit!(UpdateRewardRateEvent { new_rate }); // 触发更新奖励率事件
        Ok(()) // 返回成功
    }

    // 管理员向奖励金库注资
    pub fn fund_rewards(ctx: Context<FundRewards>, amount: u64) -> Result<()> {
        require_gt!(amount, 0, StakingError::ZeroFundAmount); // 确保注资金额大于 0

        // 执行代币转账：从管理员钱包到奖励金库
        token_2022::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.funder_wallet.to_account_info(), // 管理员钱包
                    mint: ctx.accounts.reward_mint.to_account_info(),
                    to: ctx.accounts.reward_vault.to_account_info(), // 奖励金库
                    authority: ctx.accounts.admin.to_account_info(), // 管理员签名
                },
            ),
            amount,
            ctx.accounts.reward_mint.decimals,
        )?;

        emit!(FundRewardsEvent { amount }); // 触发注资事件
        Ok(()) // 返回成功
    }

    // 管理员更改管理员权限
    pub fn change_admin(ctx: Context<AdminAction>, new_admin: Pubkey) -> Result<()> {
        ctx.accounts.pool.admin = new_admin; // 更新管理员公钥
        emit!(ChangeAdminEvent { new_admin }); // 触发更改管理员事件
        Ok(()) // 返回成功
    }

    // 管理员紧急提取质押代币
    pub fn emergency_withdraw_staked_tokens(
        ctx: Context<EmergencyWithdrawStaked>,
        amount: u64,
    ) -> Result<()> {
        let pool = &ctx.accounts.pool; // 获取池子账户引用
        let pool_seeds = &[b"pool".as_ref(), &[pool.pool_bump]]; // 设置 PDA 签名种子
        let signer = &[&pool_seeds[..]];

        // 执行代币转账：从质押金库到目标钱包
        token_2022::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.staking_vault.to_account_info(), // 质押金库
                    mint: ctx.accounts.staking_mint.to_account_info(),
                    to: ctx.accounts.destination_wallet.to_account_info(), // 目标钱包
                    authority: pool.to_account_info(),                     // 池子 PDA 作为权限
                },
                signer,
            ),
            amount,
            ctx.accounts.staking_mint.decimals,
        )?;

        Ok(()) // 返回成功
    }

    // 管理员紧急提取奖励代币
    pub fn emergency_withdraw_reward_tokens(
        ctx: Context<EmergencyWithdrawRewards>,
        amount: u64,
    ) -> Result<()> {
        let pool = &ctx.accounts.pool; // 获取池子账户引用
        let pool_seeds = &[b"pool".as_ref(), &[pool.pool_bump]]; // 设置 PDA 签名种子
        let signer = &[&pool_seeds[..]];

        // 执行代币转账：从奖励金库到目标钱包
        token_2022::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.reward_vault.to_account_info(), // 奖励金库
                    mint: ctx.accounts.reward_mint.to_account_info(),
                    to: ctx.accounts.destination_wallet.to_account_info(), // 目标钱包
                    authority: pool.to_account_info(),                     // 池子 PDA 作为权限
                },
                signer,
            ),
            amount,
            ctx.accounts.reward_mint.decimals, // 关键：传入代币的小数位数
        )?;

        Ok(()) // 返回成功
    }

    // 管理员暂停程序，阻止用户操作
    pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
        let pool = &mut ctx.accounts.pool; // 获取池子账户可变引用
        require!(!pool.is_paused, StakingError::AlreadyPaused); // 确保程序未暂停
        pool.is_paused = true; // 设置暂停状态
        emit!(PauseEvent {}); // 触发暂停事件
        Ok(()) // 返回成功
    }

    // 管理员恢复程序，允许用户操作
    pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
        let pool = &mut ctx.accounts.pool; // 获取池子账户可变引用
        require!(pool.is_paused, StakingError::NotPaused); // 确保程序已暂停
        pool.is_paused = false; // 取消暂停状态
        emit!(UnpauseEvent {}); // 触发恢复事件
        Ok(()) // 返回成功
    }

    // 管理员更新锁定期
    pub fn update_lockup_duration(ctx: Context<AdminAction>, new_duration: i64) -> Result<()> {
        let pool = &mut ctx.accounts.pool; // 获取池子账户可变引用
        pool.lockup_duration = new_duration; // 设置新锁定期
        emit!(UpdateLockupDurationEvent { new_duration }); // 触发更新锁定期事件
        Ok(()) // 返回成功
    }
}

// 定义账户结构和约束

// 初始化指令的账户结构
#[derive(Accounts)]
pub struct Initialize<'info> {
    // 初始化池子账户，分配空间并设置 PDA 种子
    #[account(
        init,
        payer = admin,
        space = 8 + Pool::INIT_SPACE,
        seeds = [b"pool"],
        bump
    )]
    pub pool: Account<'info, Pool>,
    #[account(mut)] // 管理员签名者，支付初始化费用
    pub admin: Signer<'info>,
    pub staking_mint: InterfaceAccount<'info, Mint>, // 质押代币 Mint 账户
    // 初始化质押金库，权限归池子
    #[account(init, payer = admin, token::mint = staking_mint, token::authority = pool, seeds = [b"staking_vault"], bump
    )]
    pub staking_vault: InterfaceAccount<'info, TokenAccount>,
    pub reward_mint: InterfaceAccount<'info, Mint>, // 奖励代币 Mint 账户
    // 初始化奖励金库，权限归池子
    #[account(init, payer = admin, token::mint = reward_mint, token::authority = pool, seeds = [b"reward_vault"], bump
    )]
    pub reward_vault: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>, // 系统程序，用于账户创建
    pub token_program: Program<'info, Token2022>, // Token 程序，用于代币操作
    pub rent: Sysvar<'info, Rent>,              // 租金 Sysvar，用于账户空间计算
}

// 质押指令的账户结构
#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)] // 用户签名者
    pub user: Signer<'info>,
    // 池子账户，验证 PDA 和质押金库
    #[account(mut, seeds = [b"pool"], bump = pool.pool_bump, has_one = staking_vault,has_one = staking_mint)]
    pub pool: Account<'info, Pool>,
    // 用户质押信息账户，按需初始化
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserStakeInfo::INIT_SPACE,
        seeds = [b"stake_info", user.key().as_ref()],
        bump
    )]
    pub user_stake_info: Account<'info, UserStakeInfo>,
    // 用户质押代币钱包，验证 Mint 匹配
    #[account(mut, constraint = user_staking_wallet.mint == pool.staking_mint)]
    pub user_staking_wallet: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)] // 质押金库，可变
    pub staking_vault: InterfaceAccount<'info, TokenAccount>,
    // 质押代币的 Mint 账户，用于 transfer_checked
    pub staking_mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>, // 系统程序
    pub token_program: Program<'info, Token2022>, // Token 程序
}

// 取消质押指令的账户结构
#[derive(Accounts)]
pub struct UnStake<'info> {
    #[account(mut)] // 用户签名者
    pub user: Signer<'info>,
    // 池子账户，验证 PDA 和质押金库
    #[account(mut, seeds = [b"pool"], bump = pool.pool_bump, has_one = staking_vault)]
    pub pool: Account<'info, Pool>,
    // 用户质押信息账户
    #[account(mut, seeds = [b"stake_info", user.key().as_ref()], bump)]
    pub user_stake_info: Account<'info, UserStakeInfo>,
    // 用户质押代币钱包
    #[account(mut, constraint = user_staking_wallet.mint == pool.staking_mint)]
    pub user_staking_wallet: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)] // 质押金库
    pub staking_vault: InterfaceAccount<'info, TokenAccount>,
    pub staking_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Program<'info, Token2022>, // Token 程序
}

// 领取奖励指令的账户结构
#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)] // 用户签名者
    pub user: Signer<'info>,
    // 池子账户，验证 PDA 和奖励金库
    #[account(mut, seeds = [b"pool"], bump = pool.pool_bump, has_one = reward_vault)]
    pub pool: Account<'info, Pool>,
    // 用户质押信息账户
    #[account(mut, seeds = [b"stake_info", user.key().as_ref()], bump)]
    pub user_stake_info: Account<'info, UserStakeInfo>,
    // 用户奖励代币钱包
    #[account(mut, constraint = user_reward_wallet.mint == pool.reward_mint)]
    pub user_reward_wallet: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)] // 奖励金库
    pub reward_vault: InterfaceAccount<'info, TokenAccount>,
    pub reward_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Program<'info, Token2022>, // Token 程序
}

// 关闭用户质押信息账户的结构
#[derive(Accounts)]
pub struct CloseUserStakeInfo<'info> {
    #[account(mut)] // 用户签名者
    pub user: Signer<'info>,
    // 用户质押信息账户，关闭后租金返还
    #[account(mut, seeds = [b"stake_info", user.key().as_ref()], bump, close = user)]
    pub user_stake_info: Account<'info, UserStakeInfo>,
}

// 管理员操作指令的账户结构
#[derive(Accounts)]
pub struct AdminAction<'info> {
    // 池子账户，验证管理员权限
    #[account(mut, seeds = [b"pool"], bump = pool.pool_bump, has_one = admin)]
    pub pool: Account<'info, Pool>,
    pub admin: Signer<'info>, // 管理员签名者
}

// 注资奖励金库的账户结构
#[derive(Accounts)]
pub struct FundRewards<'info> {
    // 池子账户，验证管理员和奖励金库
    #[account(has_one = admin)]
    pub pool: Account<'info, Pool>,
    pub admin: Signer<'info>, // 管理员签名者
    // 管理员的奖励代币钱包
    #[account(mut, constraint = funder_wallet.mint == pool.reward_mint)]
    pub funder_wallet: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, address = pool.reward_vault)] // 奖励金库
    pub reward_vault: InterfaceAccount<'info, TokenAccount>,
    // 奖励代币的 Mint 账户，用于 transfer_checked
    pub reward_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Program<'info, Token2022>, // Token 程序
}

// 紧急提取质押代币的账户结构
#[derive(Accounts)]
pub struct EmergencyWithdrawStaked<'info> {
    // 池子账户，验证管理员和质押金库
    #[account(has_one = admin)]
    pub pool: Account<'info, Pool>,
    pub admin: Signer<'info>, // 管理员签名者
    #[account(mut, address = pool.staking_vault)] // 质押金库
    pub staking_vault: InterfaceAccount<'info, TokenAccount>,
    pub staking_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)] // 目标钱包
    pub destination_wallet: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>, // Token 程序
}

// 紧急提取奖励代币的账户结构
#[derive(Accounts)]
pub struct EmergencyWithdrawRewards<'info> {
    // 池子账户，验证管理员和奖励金库
    #[account(
        has_one = admin,
        has_one = reward_mint,
        has_one = reward_vault
    )]
    pub pool: Account<'info, Pool>,
    pub admin: Signer<'info>, // 管理员签名者
    #[account(mut)]
    pub reward_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, address = pool.reward_vault)] // 奖励金库
    pub reward_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)] // 目标钱包
    pub destination_wallet: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token2022>, // Token 程序
}

// 定义状态账户结构

// 池子状态账户，存储全局质押信息
#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub admin: Pubkey,                 // 管理员公钥
    pub staking_mint: Pubkey,          // 质押代币 Mint 地址
    pub staking_vault: Pubkey,         // 质押金库地址
    pub reward_mint: Pubkey,           // 奖励代币 Mint 地址
    pub reward_vault: Pubkey,          // 奖励金库地址
    pub reward_rate: u64,              // 每秒奖励代币数量
    pub last_update_timestamp: i64,    // 最后更新时间戳
    pub total_staked: u64,             // 总质押量
    pub reward_per_token_stored: u128, // 每单位代币的累计奖励（高精度）
    pub pool_bump: u8,                 // 池子 PDA bump 值
    pub lockup_duration: i64,          // 锁定期（秒）
    pub is_paused: bool,               // 程序暂停状态
}

// 用户质押信息账户，存储用户特定数据
#[account]
#[derive(Default, InitSpace)]
pub struct UserStakeInfo {
    pub stake_amount: u64,           // 用户质押金额
    pub stake_start_timestamp: i64,  // 质押开始时间戳
    pub reward_per_token_paid: u128, // 用户上次同步的奖励基准
    pub rewards: u64,                // 已计算但未领取的奖励
}

// 定义精度因子，10^12 提供足够精度，适配 u128 和 u64
const PRECISION: u128 = 1_000_000_000_000;

// 实现池子奖励更新逻辑
impl Pool {
    // 更新全局和用户奖励，在用户交互或管理员操作前调用
    pub fn update_rewards(
        &mut self,
        user_stake_info: Option<&mut Account<UserStakeInfo>>,
    ) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp; // 获取当前区块链时间
                                                         // 计算时间差，saturating_sub 防止时间回退导致负数
        let time_elapsed = current_time.saturating_sub(self.last_update_timestamp) as u128;

        // 仅当时间流逝且有质押代币时，更新全局奖励
        if time_elapsed > 0 && self.total_staked > 0 {
            // 计算总奖励：时间 * 奖励率
            let rewards_accrued = time_elapsed
                .checked_mul(self.reward_rate as u128)
                .ok_or(StakingError::ArithmeticOverflow)?;
            // 计算每单位代币奖励增量：(总奖励 * 精度) / 总质押量
            let reward_per_token_increment = rewards_accrued
                .checked_mul(PRECISION)
                .ok_or(StakingError::ArithmeticOverflow)?
                .checked_div(self.total_staked as u128)
                .ok_or(StakingError::ArithmeticOverflow)?;
            // 更新全局奖励指数
            self.reward_per_token_stored = self
                .reward_per_token_stored
                .checked_add(reward_per_token_increment)
                .ok_or(StakingError::ArithmeticOverflow)?;
        }

        self.last_update_timestamp = current_time; // 更新最后时间戳

        // 如果提供用户质押信息，计算并更新用户奖励
        if let Some(info) = user_stake_info {
            // 计算用户待领奖励
            let pending_rewards = info.calculate_pending_rewards(self);
            // 累加到用户奖励字段
            info.rewards = info
                .rewards
                .checked_add(pending_rewards)
                .ok_or(StakingError::ArithmeticOverflow)?;
            // 同步用户奖励基准到当前全局值
            info.reward_per_token_paid = self.reward_per_token_stored;
        }

        Ok(()) // 返回成功
    }
}

// 实现用户待领奖励计算逻辑
impl UserStakeInfo {
    // 计算用户自上次同步以来的待领奖励
    pub fn calculate_pending_rewards(&self, pool: &Pool) -> u64 {
        // 计算未同步的奖励基准差：全局奖励指数 - 用户上次同步值
        let reward_per_token_pending = pool
            .reward_per_token_stored
            .checked_sub(self.reward_per_token_paid)
            .unwrap_or(0);
        // 计算待领奖励：(质押量 * 奖励差) / 精度
        let pending_rewards = (self.stake_amount as u128)
            .checked_mul(reward_per_token_pending)
            .unwrap_or(0)
            .checked_div(PRECISION)
            .unwrap_or(0);
        // 转换为 u64，异常情况返回 0
        pending_rewards.try_into().unwrap_or(0)
    }
}

// 定义事件，用于记录操作日志

#[event]
pub struct StakeEvent {
    pub user: Pubkey, // 质押用户公钥
    pub amount: u64,  // 质押金额
}

#[event]
pub struct UnstakeEvent {
    pub user: Pubkey, // 取消质押用户公钥
    pub amount: u64,  // 取消质押金额
}

#[event]
pub struct ClaimEvent {
    pub user: Pubkey, // 领取奖励用户公钥
    pub amount: u64,  // 领取奖励金额
}

#[event]
pub struct UpdateRewardRateEvent {
    pub new_rate: u64,
} // 奖励率更新事件
#[event]
pub struct FundRewardsEvent {
    pub amount: u64,
} // 注资事件
#[event]
pub struct ChangeAdminEvent {
    pub new_admin: Pubkey,
} // 更改管理员事件
#[event]
pub struct PauseEvent {} // 暂停事件
#[event]
pub struct UnpauseEvent {} // 恢复事件
#[event]
pub struct UpdateLockupDurationEvent {
    pub new_duration: i64,
} // 更新锁定期事件

// 定义错误码，描述可能的失败场景
#[error_code]
pub enum StakingError {
    #[msg("Amount must be greater than zero.")] // 质押金额必须大于 0
    ZeroStakeAmount,
    #[msg("Unstake amount must be greater than zero.")] // 取消质押金额必须大于 0
    ZeroUnstakeAmount,
    #[msg("Funding amount must be greater than zero.")] // 注资金额必须大于 0
    ZeroFundAmount,
    #[msg("Insufficient staked amount.")] // 质押金额不足
    InsufficientStakeAmount,
    #[msg("Lockup period has not ended yet.")] // 时间锁未结束
    LockupPeriodNotEnded,
    #[msg("No rewards to claim.")] // 无奖励可领取
    NoRewardsToClaim,
    #[msg("Stake amount must be zero to close account.")] // 关闭账户需无质押
    StakeNotZero,
    #[msg("All rewards must be claimed to close account.")] // 关闭账户需领取所有奖励
    RewardsNotClaimed,
    #[msg("Only the admin can perform this action.")] // 仅管理员可执行
    NotAdmin,
    #[msg("An arithmetic operation overflowed.")] // 算术溢出错误
    ArithmeticOverflow,
    #[msg("Program is paused.")] // 程序已暂停
    ProgramPaused,
    #[msg("Program is already paused.")] // 程序已处于暂停状态
    AlreadyPaused,
    #[msg("Program is not paused.")] // 程序未暂停
    NotPaused,
    #[msg("Insufficient balance in reward vault.")] // 奖励金库余额不足
    InsufficientVaultBalance,
}
