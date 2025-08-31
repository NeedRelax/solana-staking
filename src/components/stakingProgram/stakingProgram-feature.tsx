// 声明这是一个客户端组件（Next.js App Router特性），仅在客户端运行
'use client'

// 导入 Solana 钱包适配器的 React 钩子，用于获取钱包状态
import { useWallet } from '@solana/wallet-adapter-react'
// 导入 Solana 钱包连接按钮组件，用于用户连接钱包
import { WalletButton } from '../solana/solana-provider'
// 导入区块浏览器链接组件，用于生成指向 Solana 账户的链接
import { ExplorerLink } from '../cluster/cluster-ui'
// 导入自定义的质押程序钩子，用于获取质押程序相关数据和方法
import { useStakingProgram } from './stakingProgram-data-access'
// 导入质押程序的 UI 组件，包括初始化池和仪表板组件
import { InitializePool, StakingDashboard } from './stakingProgram-ui'
// 导入应用英雄区域组件，用于显示标题和副标题
import { AppHero } from '../app-hero'
// 导入工具函数，用于截断字符串显示
import { ellipsify } from '@/lib/utils'

// 默认导出的质押功能组件，保持组件名不变
export default function CounterFeature() {
  // 使用 useWallet 钩子获取当前连接钱包的公钥
  const { publicKey } = useWallet()
  // 使用 useStakingProgram 钩子获取质押程序的程序 ID 和质押池查询
  const { programId, poolQuery } = useStakingProgram()

  // 根据是否连接钱包决定渲染内容
  return publicKey ? (
    // 如果用户已连接钱包，显示质押相关界面
    <div>
      {/* 渲染应用英雄区域，展示标题和副标题 */}
      <AppHero
        title="Token Staking Program" // 设置英雄区域标题
        subtitle="Stake your tokens to earn rewards. All state is stored and managed on the Solana blockchain." // 设置副标题
      >
        {/* 显示程序 ID 的区块浏览器链接 */}
        <p className="mb-6">
          {/* 使用 ExplorerLink 组件生成指向程序 ID 的链接，并用 ellipsify 截断显示 */}
          <ExplorerLink path={`account/${programId}`} label={ellipsify(programId.toString())} />
        </p>
      </AppHero>

      {/* 根据质押池查询状态渲染不同内容 */}
      {poolQuery.isLoading ? ( // 如果质押池数据正在加载
        // 显示加载中的 UI
        <div className="flex justify-center">
          {/* 渲染加载指示器（spinner） */}
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : poolQuery.data ? ( // 如果质押池数据已加载且存在
        // 渲染质押仪表板组件
        <StakingDashboard />
      ) : (
        // 如果质押池数据不存在（尚未初始化）
        // 渲染初始化质押池的表单组件
        <InitializePool />
      )}
    </div>
  ) : (
    // 如果用户未连接钱包
    <div className="max-w-4xl mx-auto">
      {/* 渲染英雄区域，用于提示用户连接钱包 */}
      <div className="hero py-[64px]">
        {/* 英雄区域的内容，居中显示 */}
        <div className="hero-content text-center">
          {/* 渲染钱包连接按钮 */}
          <WalletButton />
        </div>
      </div>
    </div>
  )
}
