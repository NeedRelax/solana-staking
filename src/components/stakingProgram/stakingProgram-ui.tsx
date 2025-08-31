// 声明这是一个客户端组件（Next.js App Router特性），仅在客户端运行
'use client'

// 导入 Solana 钱包适配器的 React 钩子，用于获取钱包和连接状态
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
// 导入 Solana Web3.js 的 PublicKey 类，用于处理公钥
import { PublicKey } from '@solana/web3.js'
// 导入 React 的核心功能，包括状态管理和记忆优化
import React, { useState, useMemo } from 'react'
// 导入区块浏览器链接组件，用于生成指向 Solana 账户的链接
import { ExplorerLink } from '../cluster/cluster-ui'
// 导入自定义的质押程序钩子，用于获取质押相关数据和操作
import { useStakingProgram, useUserStakeInfo, useTokenBalance } from './stakingProgram-data-access'
// 导入 UI 组件，包括按钮、卡片和输入框
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '@/components/ui/input'
// 导入 sonner 的 toast 函数，用于显示通知
import { toast } from 'sonner'
// 导入工具函数，用于截断字符串显示
import { ellipsify } from '@/lib/utils'
// 导入 Alert 组件，用于显示警告信息
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
// 导入 Radix UI 的警告图标
import { ExclamationTriangleIcon } from '@radix-ui/react-icons'
// 导入 Tanstack Query 的 useQuery 钩子，用于数据查询
import { useQuery } from '@tanstack/react-query'

/**
 * 初始化质押池的组件，仅当质押池未创建时显示
 */
export function InitializePool() {
  // 使用 useStakingProgram 钩子获取初始化质押池的 mutation 方法
  const { initialize } = useStakingProgram()
  // 使用 useState 管理质押代币的 Mint 地址输入
  const [stakingMint, setStakingMint] = useState('')
  // 使用 useState 管理奖励代币的 Mint 地址输入
  const [rewardMint, setRewardMint] = useState('')
  // 使用 useState 管理奖励率输入（默认每秒 10 个奖励代币）
  const [rewardRate, setRewardRate] = useState('100')
  // 使用 useState 管理锁仓时长输入（默认 100 秒）
  const [lockupDuration, setLockupDuration] = useState('100')

  // 定义处理初始化质押池的函数
  const handleInitialize = () => {
    try {
      // 将质押代币 Mint 地址字符串转换为 PublicKey 对象
      const stakingMintPk = new PublicKey(stakingMint)
      // 将奖励代币 Mint 地址字符串转换为 PublicKey 对象
      const rewardMintPk = new PublicKey(rewardMint)
      // 将奖励率字符串转换为整数
      const rate = parseInt(rewardRate, 10)
      // 将锁仓时长字符串转换为整数
      const duration = parseInt(lockupDuration, 10)

      // 验证奖励率和锁仓时长是否为有效数字
      if (isNaN(rate) || isNaN(duration)) {
        // 如果无效，显示错误提示
        toast.error('Invalid number for rate or duration.')
        return
      }

      // 调用 initialize mutation 执行链上初始化操作
      initialize.mutate({
        stakingMint: stakingMintPk, // 质押代币 Mint 地址
        rewardMint: rewardMintPk, // 奖励代币 Mint 地址
        rewardRate: rate, // 奖励率
        lockupDuration: duration, // 锁仓时长
      })
    } catch (e) {
      // 如果公钥格式错误，显示错误提示
      toast.error('Invalid public key provided.')
      // 记录错误信息
      console.error(e)
    }
  }

  // 渲染初始化质押池的表单 UI
  return (
    <Card className="max-w-2xl mx-auto">
      {/* 卡片头部，显示标题和描述 */}
      <CardHeader>
        <CardTitle>初始化质押池</CardTitle>
        <CardDescription>此操作由管理员执行一次，以创建全局质押池。</CardDescription>
      </CardHeader>
      {/* 卡片内容，包含输入框和按钮 */}
      <CardContent className="space-y-4">
        {/* 输入质押代币 Mint 地址 */}
        <Input placeholder="质押代币 Mint 公钥" value={stakingMint} onChange={(e) => setStakingMint(e.target.value)} />
        {/* 输入奖励代币 Mint 地址 */}
        <Input placeholder="奖励代币 Mint 公钥" value={rewardMint} onChange={(e) => setRewardMint(e.target.value)} />
        {/* 输入奖励率（每秒奖励代币数量） */}
        <Input
          placeholder="奖励率（每秒，整数）"
          type="number"
          value={rewardRate}
          onChange={(e) => setRewardRate(e.target.value)}
        />
        {/* 输入锁仓时长（秒） */}
        <Input
          placeholder="锁仓时长（秒）"
          type="number"
          value={lockupDuration}
          onChange={(e) => setLockupDuration(e.target.value)}
        />
        {/* 初始化按钮 */}
        <Button onClick={handleInitialize} disabled={initialize.isPending}>
          初始化质押池 {initialize.isPending && '...'}
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * 主仪表盘组件，显示质押池概览、用户面板和管理员面板
 */
export function StakingDashboard() {
  // 使用 useStakingProgram 钩子获取质押池查询和奖励金库 PDA
  const { poolQuery, rewardVaultPda } = useStakingProgram()
  // 使用 useConnection 钩子获取 Solana 连接实例
  const { connection } = useConnection()

  // 查询奖励金库余额
  const { data: vaultBalance, isLoading: isVaultBalanceLoading } = useQuery({
    // 定义查询的唯一 key，基于奖励金库 PDA
    queryKey: ['vault-balance', rewardVaultPda?.toBase58()],
    // 查询函数，异步获取金库余额
    queryFn: async () => {
      // 如果奖励金库 PDA 无效，返回 null
      if (!rewardVaultPda) return null
      try {
        // 获取奖励金库的代币账户余额
        const balance = await connection.getTokenAccountBalance(rewardVaultPda)
        // 返回用户友好的余额（带小数）
        return balance.value.uiAmount
      } catch (e) {
        // 如果获取失败，返回 0
        return 0
      }
    },
    // 仅当奖励金库 PDA 和连接有效时启用查询
    enabled: !!rewardVaultPda && !!connection,
    // 每 10 秒刷新一次余额
    refetchInterval: 10000,
  })

  // 查询总质押量（转换为 UI 可读格式）
  const { data: totalStakedUiAmount, isLoading: isTotalStakedLoading } = useQuery({
    // 定义查询的唯一 key，基于质押代币 Mint 和总质押量
    queryKey: ['total-staked', poolQuery.data?.stakingMint.toBase58(), poolQuery.data?.totalStaked.toString()],
    // 查询函数，异步计算总质押量
    queryFn: async () => {
      // 如果质押池数据无效或总质押量为 0，返回 0
      if (!poolQuery.data || poolQuery.data.totalStaked.isZero()) return 0
      // 获取质押代币的供应信息以确定小数位数
      const supply = await connection.getTokenSupply(poolQuery.data.stakingMint)
      const decimals = supply.value.decimals
      // 将原始总质押量转换为 UI 可读格式
      return Number(poolQuery.data.totalStaked) / 10 ** decimals
    },
    // 仅当质押池数据和连接有效时启用查询
    enabled: !!poolQuery.data && !!connection,
  })

  // 如果质押池数据仍在加载，显示加载状态
  if (!poolQuery.data) {
    return <div className="text-center">正在加载质押池数据...</div>
  }

  // 渲染主仪表盘 UI
  return (
    <div className="space-y-6">
      {/* 质押池概览卡片 */}
      <Card>
        <CardHeader>
          <CardTitle>质押池概览</CardTitle>
          <CardDescription>
            管理员:{' '}
            <ExplorerLink path={`account/${poolQuery.data.admin}`} label={ellipsify(poolQuery.data.admin.toString())} />
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* 显示总质押量 */}
          <InfoBox
            title="总质押量"
            value={isTotalStakedLoading ? '...' : (totalStakedUiAmount ?? 0).toLocaleString()}
          />
          {/* 显示奖励金库余额 */}
          <InfoBox title="奖励金库" value={isVaultBalanceLoading ? '...' : (vaultBalance ?? 0).toLocaleString()} />
          {/* 显示每秒奖励率 */}
          <InfoBox title="奖励率/秒" value={poolQuery.data.rewardRate.toString()} />
          {/* 显示锁仓时长 */}
          <InfoBox title="锁仓时长" value={`${poolQuery.data.lockupDuration.toString()}秒`} />
          {/* 显示质押池状态 */}
          <InfoBox
            title="状态"
            value={poolQuery.data.isPaused ? '已暂停' : '活跃'}
            isStatus={true}
            isActive={!poolQuery.data.isPaused}
          />
        </CardContent>
      </Card>

      {/* 如果程序已暂停，显示警告信息 */}
      {poolQuery.data.isPaused && (
        <Alert variant="destructive">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertTitle>程序已暂停</AlertTitle>
          <AlertDescription>管理员已暂时禁用质押、取消质押和领取奖励功能。</AlertDescription>
        </Alert>
      )}

      {/* 渲染用户面板和管理员面板 */}
      <div className="grid md:grid-cols-2 gap-10">
        <UserPanel />
        <AdminPanel />
      </div>
    </div>
  )
}

// 信息框组件，用于显示键值对信息
const InfoBox = ({
  title, // 信息标题
  value, // 信息值
  isStatus = false, // 是否为状态信息
  isActive = false, // 状态是否为活跃
}: {
  title: string
  value: string
  isStatus?: boolean
  isActive?: boolean
}) => (
  <div className="p-4 border rounded-md">
    {/* 显示标题 */}
    <p className="text-sm text-muted-foreground">{title}</p>
    {/* 显示值，状态信息根据活跃状态设置颜色 */}
    <p className={`text-2xl font-bold ${isStatus ? (isActive ? 'text-green-500' : 'text-red-500') : ''}`}>{value}</p>
  </div>
)

/**
 * 用户操作面板，用于执行质押、取消质押和领取奖励操作
 */
function UserPanel() {
  // 使用 useUserStakeInfo 钩子获取用户质押信息和相关操作
  const { userStakeInfoQuery, stake, unstake, claimRewards, closeUserStakeInfo } = useUserStakeInfo()
  // 使用 useStakingProgram 钩子获取质押池查询
  const { poolQuery } = useStakingProgram()
  // 使用 useConnection 钩子获取 Solana 连接实例
  const { connection } = useConnection()
  // 使用 useState 管理质押/取消质押的金额输入
  const [amount, setAmount] = useState('')

  // 获取质押代币和奖励代币的 Mint 地址
  const stakingMint = poolQuery.data?.stakingMint
  const rewardMint = poolQuery.data?.rewardMint

  // 查询用户钱包中的质押代币余额
  const { data: stakingTokenBalance, isLoading: isStakingBalanceLoading } = useTokenBalance(stakingMint)
  // 查询用户钱包中的奖励代币余额
  const { data: rewardTokenBalance, isLoading: isRewardBalanceLoading } = useTokenBalance(rewardMint)

  // 使用 useMemo 计算用户的质押金额和奖励金额（转换为 UI 可读格式）
  const { stakedAmount, rewardsAmount } = useMemo(() => {
    // 如果用户质押信息或质押池数据无效，返回 0
    if (!userStakeInfoQuery.data || !poolQuery.data) {
      return { stakedAmount: 0, rewardsAmount: 0 }
    }
    // 获取质押代币和奖励代币的小数位数
    const stakeDecimals = stakingTokenBalance?.decimals ?? 0
    const rewardDecimals = rewardTokenBalance?.decimals ?? 0

    // 将原始金额转换为 UI 可读格式
    return {
      stakedAmount: stakeDecimals > 0 ? Number(userStakeInfoQuery.data.stakeAmount) / 10 ** stakeDecimals : 0,
      rewardsAmount: rewardDecimals > 0 ? Number(userStakeInfoQuery.data.rewards) / 10 ** rewardDecimals : 0,
    }
  }, [userStakeInfoQuery.data, poolQuery.data, stakingTokenBalance, rewardTokenBalance])

  // 如果用户质押信息仍在加载，显示加载状态
  if (userStakeInfoQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>我的质押</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-24">
          {/* 显示加载指示器 */}
          <span className="loading loading-spinner"></span>
        </CardContent>
      </Card>
    )
  }

  // 如果用户没有质押账户，显示初始质押界面
  if (!userStakeInfoQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>我的质押</CardTitle>
          <CardDescription>您当前没有活跃的质押。质押一些代币以开始赚取奖励。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 显示用户钱包余额 */}
          <UserWalletBalances />
          <div>
            {/* 输入质押金额 */}
            <Input placeholder="质押金额" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="flex gap-2 mt-2">
              {/* 质押按钮 */}
              <Button
                className="flex-1"
                onClick={() => stake.mutate(parseFloat(amount))}
                disabled={!amount || stake.isPending || poolQuery.data?.isPaused}
              >
                质押 {stake.isPending && '...'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // 获取用户质押信息
  const { stakeAmount: stakeAmountBN, rewards: rewardsBN, stakeStartTimestamp } = userStakeInfoQuery.data

  // 计算锁仓结束时间
  const lockupEndTime = poolQuery.data ? Number(stakeStartTimestamp) + Number(poolQuery.data.lockupDuration) : 0
  // 检查是否仍在锁仓期内
  const isLocked = new Date().getTime() / 1000 < lockupEndTime
  // 检查是否可以关闭账户（质押金额和奖励金额均为 0）
  const canCloseAccount = stakeAmountBN.isZero() && rewardsBN.isZero()

  // 渲染用户质押面板
  return (
    <Card>
      <CardHeader>
        <CardTitle>我的质押</CardTitle>
        <CardDescription>{`已质押: ${stakedAmount.toLocaleString()} | 可领取奖励: ${rewardsAmount.toLocaleString()}`}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 显示用户钱包余额 */}
        <UserWalletBalances />
        <div>
          {/* 输入质押/取消质押金额 */}
          <Input
            placeholder="质押/取消质押金额"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            {/* 质押按钮 */}
            <Button
              className="flex-1"
              onClick={() => stake.mutate(parseFloat(amount))}
              disabled={!amount || stake.isPending || poolQuery.data?.isPaused}
            >
              质押 {stake.isPending && '...'}
            </Button>
            {/* 取消质押按钮 */}
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => unstake.mutate(parseFloat(amount))}
              disabled={!amount || unstake.isPending || poolQuery.data?.isPaused || stakeAmountBN.isZero() || isLocked}
            >
              取消质押 {unstake.isPending && '...'}
            </Button>
          </div>
          {/* 如果仍在锁仓期内，显示锁仓提示 */}
          {isLocked && !stakeAmountBN.isZero() && (
            <p className="text-xs text-yellow-500 mt-2">
              您的质押在 {new Date(lockupEndTime * 1000).toLocaleString()} 前被锁定
            </p>
          )}
        </div>
        {/* 领取奖励按钮 */}
        <Button
          className="w-full"
          onClick={() => claimRewards.mutate()}
          disabled={claimRewards.isPending || poolQuery.data?.isPaused || rewardsBN.isZero()}
        >
          领取奖励 {claimRewards.isPending && '...'}
        </Button>
        <hr />
        {/* 如果可以关闭账户，显示关闭账户选项 */}
        {canCloseAccount && (
          <div>
            <h3 className="text-sm font-semibold mb-2">账户管理</h3>
            <p className="text-xs text-muted-foreground mb-2">您的质押账户为空。您可以关闭它以回收租金（SOL）。</p>
            {/* 关闭账户按钮 */}
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => {
                // 弹出确认对话框
                if (!window.confirm('您确定要关闭您的质押账户吗？此操作不易撤销。')) return
                // 调用关闭账户 mutation
                closeUserStakeInfo.mutate()
              }}
              disabled={closeUserStakeInfo.isPending}
            >
              关闭质押账户 {closeUserStakeInfo.isPending && '...'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 显示用户钱包余额的组件
function UserWalletBalances() {
  // 使用 useStakingProgram 钩子获取质押池查询
  const { poolQuery } = useStakingProgram()
  // 获取质押代币和奖励代币的 Mint 地址
  const stakingMint = poolQuery.data?.stakingMint
  const rewardMint = poolQuery.data?.rewardMint

  // 查询用户钱包中的质押代币余额
  const { data: stakingTokenBalance, isLoading: isStakingBalanceLoading } = useTokenBalance(stakingMint)
  // 查询用户钱包中的奖励代币余额
  const { data: rewardTokenBalance, isLoading: isRewardBalanceLoading } = useTokenBalance(rewardMint)

  // 渲染用户钱包余额 UI
  return (
    <div className="p-3 border rounded-md bg-muted/50 text-sm space-y-1">
      <div className="flex justify-between">
        <span className="text-muted-foreground">您的质押代币余额:</span>
        <span className="font-mono">
          {isStakingBalanceLoading ? '...' : (stakingTokenBalance?.amount ?? 0).toLocaleString()}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">您的奖励代币余额:</span>
        <span className="font-mono">
          {isRewardBalanceLoading ? '...' : (rewardTokenBalance?.amount ?? 0).toLocaleString()}
        </span>
      </div>
    </div>
  )
}

/**
 * 管理员面板，用于管理质押池的各种操作
 */
function AdminPanel() {
  // 使用 useWallet 钩子获取当前连接的钱包公钥
  const { publicKey } = useWallet()
  // 使用 useStakingProgram 钩子获取质押池相关数据和操作
  const {
    poolQuery, // 质押池查询
    rewardVaultPda, // 奖励金库 PDA
    fundRewards, // 注资奖励池
    updateRewardRate, // 更新奖励率
    pause, // 暂停程序
    unpause, // 恢复程序
    updateLockupDuration, // 更新锁仓时长
    burnRewardTokens, // 销毁奖励代币
    changeAdmin, // 更改管理员
    emergencyWithdrawStakedTokens, // 紧急提取质押代币
    emergencyWithdrawRewardTokens, // 紧急提取奖励代币
  } = useStakingProgram()
  // 使用 useState 管理各种输入字段
  const [fundAmount, setFundAmount] = useState('') // 注资金额
  const [newRate, setNewRate] = useState('') // 新奖励率
  const [newDuration, setNewDuration] = useState('') // 新锁仓时长
  const [burnAmount, setBurnAmount] = useState('') // 销毁金额
  const [newAdmin, setNewAdmin] = useState('') // 新管理员公钥
  const [ewAmount, setEwAmount] = useState('') // 紧急提取金额
  const [ewDestination, setEwDestination] = useState('') // 紧急提取目标地址

  // 检查当前用户是否为管理员
  const isAdmin = publicKey && poolQuery.data && publicKey.equals(poolQuery.data.admin)
  // 如果不是管理员，不渲染面板
  if (!isAdmin) return null

  // 定义处理更改管理员的操作
  const handleChangeAdmin = () => {
    try {
      // 将新管理员地址字符串转换为 PublicKey 对象
      const newAdminPk = new PublicKey(newAdmin)
      // 弹出确认对话框
      if (!window.confirm(`您确定要将管理员权限转移到 ${newAdminPk.toBase58()} 吗？此操作不可撤销。`)) {
        return
      }
      // 调用更改管理员 mutation
      changeAdmin.mutate(newAdminPk)
    } catch (e) {
      // 如果公钥格式错误，显示错误提示
      toast.error('无效的新管理员公钥。')
      // 记录错误信息
      console.error(e)
    }
  }

  // 定义处理紧急提取的操作
  const handleEmergencyWithdraw = (withdrawFunction: any) => {
    try {
      // 将输入金额转换为浮点数
      const amount = parseFloat(ewAmount)
      // 将目标地址字符串转换为 PublicKey 对象
      const destinationWallet = new PublicKey(ewDestination)

      // 验证输入金额是否有效
      if (isNaN(amount) || amount <= 0) {
        toast.error('金额必须为正数。')
        return
      }
      // 弹出确认对话框
      if (
        !window.confirm(
          `!!! 危险操作 !!!\n\n您将强制提取 ${amount} 个代币到钱包:\n${destinationWallet.toBase58()}\n\n这是紧急功能，不应在正常操作中使用。您确定要继续吗？`,
        )
      ) {
        return
      }
      // 调用紧急提取 mutation
      withdrawFunction.mutate({ amount, destinationWallet })
    } catch (e) {
      // 如果金额或目标地址无效，显示错误提示
      toast.error('无效的金额或目标公钥。')
      // 记录错误信息
      console.error(e)
    }
  }

  // 渲染管理员面板 UI
  return (
    <Card>
      <CardHeader>
        <CardTitle>管理员面板</CardTitle>
        <CardDescription>
          金库地址:{' '}
          <ExplorerLink path={`account/${rewardVaultPda}`} label={ellipsify(rewardVaultPda?.toString() ?? '')} />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 注资奖励池 */}
        <div className="flex gap-2 items-center">
          <Input
            placeholder="注资金额"
            type="number"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
          />
          <Button
            onClick={() => fundRewards.mutate(parseFloat(fundAmount))}
            disabled={!fundAmount || fundRewards.isPending}
          >
            注资奖励 {fundRewards.isPending && '...'}
          </Button>
        </div>

        {/* 更新奖励率 */}
        <div className="flex gap-2 items-center">
          <Input placeholder="新奖励率/秒" type="number" value={newRate} onChange={(e) => setNewRate(e.target.value)} />
          <Button
            onClick={() => updateRewardRate.mutate(parseInt(newRate, 10))}
            disabled={!newRate || updateRewardRate.isPending}
          >
            更新奖励率 {updateRewardRate.isPending && '...'}
          </Button>
        </div>

        {/* 更新锁仓时长 */}
        <div className="flex gap-2 items-center">
          <Input
            placeholder="新锁仓时长（秒）"
            type="number"
            value={newDuration}
            onChange={(e) => setNewDuration(e.target.value)}
          />
          <Button
            onClick={() => updateLockupDuration.mutate(parseInt(newDuration, 10))}
            disabled={!newDuration || updateLockupDuration.isPending}
          >
            更新锁仓时长 {updateLockupDuration.isPending && '...'}
          </Button>
        </div>

        <hr />

        {/* 销毁奖励代币 */}
        <div>
          <h3 className="text-sm font-semibold mb-2 text-destructive">销毁奖励代币</h3>
          <p className="text-xs text-muted-foreground mb-2">
            从<span className="font-bold">管理员钱包</span>中永久销毁奖励代币以减少总供应量。此操作不影响奖励金库。
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="销毁金额"
              type="number"
              value={burnAmount}
              onChange={(e) => setBurnAmount(e.target.value)}
              className="border-destructive"
            />
            <Button
              variant="destructive"
              onClick={() => {
                // 弹出确认对话框
                if (!window.confirm(`您确定要从钱包中永久销毁 ${burnAmount} 个奖励代币吗？`)) return
                // 调用销毁奖励代币 mutation
                burnRewardTokens.mutate(parseFloat(burnAmount))
              }}
              disabled={!burnAmount || burnRewardTokens.isPending}
            >
              销毁 {burnRewardTokens.isPending && '...'}
            </Button>
          </div>
        </div>

        {/* 更改管理员 */}
        <div>
          <h3 className="text-sm font-semibold mb-2 text-destructive">更改管理员</h3>
          <p className="text-xs text-muted-foreground mb-2">
            将管理员权限转移到新钱包。<span className="font-bold">此操作不可撤销。</span>
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="新管理员公钥"
              value={newAdmin}
              onChange={(e) => setNewAdmin(e.target.value)}
              className="border-destructive"
            />
            <Button variant="destructive" onClick={handleChangeAdmin} disabled={!newAdmin || changeAdmin.isPending}>
              更改 {changeAdmin.isPending && '...'}
            </Button>
          </div>
        </div>

        {/* 紧急操作 */}
        <div className="p-4 border-2 border-destructive rounded-lg bg-destructive/10">
          <h3 className="text-lg font-bold text-destructive">🚨 紧急操作 🚨</h3>
          <p className="text-sm text-destructive/80 mt-1 mb-4">
            仅在紧急情况下（例如合约漏洞）使用这些功能来救援资金。滥用可能导致用户信任丧失。
          </p>

          <div className="space-y-2">
            <Input
              placeholder="提取金额"
              value={ewAmount}
              onChange={(e) => setEwAmount(e.target.value)}
              className="border-destructive"
            />
            <Input
              placeholder="目标钱包公钥"
              value={ewDestination}
              onChange={(e) => setEwDestination(e.target.value)}
              className="border-destructive"
            />
          </div>

          <div className="flex gap-2 mt-4">
            {/* 紧急提取质押代币 */}
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => handleEmergencyWithdraw(emergencyWithdrawStakedTokens)}
              disabled={!ewAmount || !ewDestination || emergencyWithdrawStakedTokens.isPending}
            >
              提取质押代币 {emergencyWithdrawStakedTokens.isPending && '...'}
            </Button>
            {/* 紧急提取奖励代币 */}
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => handleEmergencyWithdraw(emergencyWithdrawRewardTokens)}
              disabled={!ewAmount || !ewDestination || emergencyWithdrawRewardTokens.isPending}
            >
              提取奖励代币 {emergencyWithdrawRewardTokens.isPending && '...'}
            </Button>
          </div>
        </div>

        <hr />

        {/* 暂停/恢复程序 */}
        {poolQuery.data?.isPaused ? (
          // 如果程序已暂停，显示恢复按钮
          <Button className="w-full" variant="secondary" onClick={() => unpause.mutate()} disabled={unpause.isPending}>
            恢复程序 {unpause.isPending && '...'}
          </Button>
        ) : (
          // 如果程序未暂停，显示暂停按钮
          <Button className="w-full" variant="destructive" onClick={() => pause.mutate()} disabled={pause.isPending}>
            暂停程序 {pause.isPending && '...'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// 导出占位组件，防止项目中的其他引用报错
export function CounterCreate() {
  return null
}
// 导出占位组件，防止项目中的其他引用报错
export function CounterList() {
  return null
}
