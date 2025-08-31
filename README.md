# Solana 高性能 DeFi 质押协议 (全栈实现)

[![License: MIT](https://imgshields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Powered by Anchor](https://imgshields.io/badge/Powered%20by-Anchor-blue.svg)](https://www.anchor-lang.com/) [![Token Standard: Token-2022](https://imgshields.io/badge/Token%20Standard-Token--2022-brightgreen.svg)](https://spl.solana.com/token-2022)

这是一个基于 Solana 和 Anchor 框架构建的企业级全栈 DeFi 质押 dApp。它提供了一个功能完备、高度安全且资源高效的解决方案，允许用户质押一种代币（Staking
Token）以赚取另一种代幣（Reward Token）作为奖励。本项目采用源自 Synthetix 的经典奖励计算模型，确保了奖励分配的公平性和可扩展性。

## ✨ 核心功能

- **灵活的质押与取消质押**:
    - 用户可以随时质押任意数量的代- 币。
    - 支持设置**锁仓期 (Lockup Duration)**，在锁定期结束后方可取消质押。
- **高效的奖励机制**:
    - **实时奖励累积**: 奖励按秒计算，用户质押时间越长、数量越多，获得的奖励也越多。
    - **即时领取**: 用户可以随时领取已累积的奖励，无需取消质押。
- **全面的管理员功能**:
    - **参数可调**: 管理员可以动态调整奖励发放速率和锁仓期。
    - **奖励池注资**: 管理员可以随时向奖励金库注入更多代币。
    - **安全开关**: 支持**暂停/恢复**整个协议，以应对紧急情况或进行维护。
    - **权限管理**: 支持安全地将管理员权限转移给新地址。
    - **紧急提款**: 提供安全后门，允许管理员在极端情况下提取金库中的质押或奖励代币，以保护用户资产。
- **现代化前端体验**:
    - **动态仪表盘**: 实时展示协议全局状态（总质押量、奖励池余额）和个人质押详情。
    - **自动账户创建**: 用户在首次质押或领取奖励时，如果缺少对应的代币账户 (ATA)，程序会自动为其创建，极大简化了用户操作。
    - **清晰的状态反馈**: 所有链上操作均有加载状态指示和清晰的成功/失败 toast 通知。

## 🛠️ 技术栈

- **智能合约**: Rust, **Anchor Framework v0.29+**
- **区块链**: Solana
- **代币标准**: **Token-2022**
- **前端框架**: **React**, **Next.js**
- **UI**: **Shadcn/UI**, Tailwind CSS, Radix UI Icons
- **异步状态管理**: **TanStack Query (React Query)**
- **钱包集成**: Solana Wallet Adapter
- **测试**: TypeScript, Mocha, Chai, Anchor Tests

## 📂 项目结构

```
.
├── anchor/                  # Anchor 项目
│   ├── programs/staking_program/ # 质押智能合约源码 (lib.rs)
│   └── tests/staking_program.ts # 集成测试脚本
├── app/                     # Next.js 前端应用
│   ├── components/staking/
│   │   ├── stakingProgram-data-access.ts # 核心数据访问层 (React Hooks)
│   │   └── stakingProgram-ui.tsx         # 所有 UI 组件
│   └── app/staking/page.tsx             # 功能主页/容器组件
├── package.json
└── README.md
```

## 🚀 快速开始

### 先决条件

- [Node.js v18 或更高版本](https://nodejs.org/en/)
- [Rust 工具链](https://www.rust-lang.org/tools/install)
- [Solana CLI v1.17 或更高版本](https://docs.solana.com/cli/install)
- [Anchor CLI v0.29 或更高版本](https://www.anchor-lang.com/docs/installation)

### 安装与部署

1. **克隆仓库**
   ```bash
   git clone <your-repo-url>
   cd <your-repo-directory>
   ```

2. **安装前端依赖**
   ```bash
   npm install
   ```

3. **构建并部署智能合约**
   ```bash
   # 启动本地 Solana 测试验证器
   solana-test-validator

   # 在另一个终端窗口中，构建并部署合约
   anchor build && anchor deploy
   ```
   部署成功后，复制输出的程序 ID，并更新前端代码中的相应位置。

4. **运行前端开发服务器**
   ```bash
   npm run dev
   ```
   在浏览器中打开 `http://localhost:3000` 即可访问 dApp。

## 🕹️ 如何使用

1. **连接钱包**: 访问应用主页，连接您的 Phantom 或其他兼容钱包（请确保网络设置为 Localnet）。
2. **管理员：初始化质押池**:
    - 首次使用时，管理员需要提供**质押代币**和**奖励代币**的 Mint 地址，并设置初始的**奖励率**和**锁仓期**。
    - 点击“初始化质押池”完成创建。
3. **管理员：注资奖励池**:
    - 在管理员面板，输入要注入的奖励代币数量，点击“注资奖励”为协议提供奖励储备。
4. **用户：质押**:
    - 在“我的质押”面板，输入您希望质押的代币数量，点击“质押”。
5. **用户：领取奖励**:
    - 随着时间的推移，您的可领取奖励会自动增加。点击“领取奖励”即可将其转入您的钱包。
6. **用户：取消质押**:
    - 在锁仓期结束后，您可以在“我的质押”面板输入数量并点击“取消质押”，取回您的本金。

## ✅ 运行测试

我们提供了全面的集成测试，覆盖了所有核心功能、边界条件和权限控制。

```bash
anchor test
```

该命令将自动执行 `tests/staking_program.ts` 中的所有测试用例。

## 📜 智能合约深度解析

智能合约 (`programs/staking_program/src/lib.rs`) 是协议的核心。

- **奖励计算模型**:
    - 本合约采用了源自 **Synthetix** 的高效奖励计算模型。该模型不需为每个用户单独计时，而是通过维护一个全局的**奖励指数
      ** (`reward_per_token_stored`) 来实现公平分配。
    - 每当用户交互时，程序会先更新这个全局指数，然后根据用户上次同步时的指数差值和其质押量，以 O(1)
      的时间复杂度精确计算出用户应得的奖励。这确保了协议即使在拥有大量用户时也能保持高性能。

- **核心账户**:
    - **`Pool` (PDA)**: 单例账户，存储所有全局配置和状态，如管理员地址、奖励率、总质押量和奖励指数。
    - **`UserStakeInfo` (PDA)**: 为每个质押用户创建的独立账户，存储其个人质押数量和奖励同步状态。
    - **`staking_vault` & `reward_vault` (PDAs)**: 由程序控制的金库，分别用于安全保管用户的质押本金和协议的奖励代币。

- **安全性**:
    - **防溢出设计**: 所有算术运算均使用 Rust 的 `checked_*` 方法，有效防止整数溢出。
    - **权限控制**: 通过 Anchor 的 `has_one` 约束严格验证管理员权限。
    - **安全开关**: `pause`/`unpause` 指令允许管理员在紧急情况下冻结协议，保护资金安全。
    - **支持 Token-2022**: 采用了最新的代币标准，具备更好的扩展性和安全性。

## 🖥️ 前端架构深度解析

前端应用 (`app/`) 采用了先进的 React 架构，实现了逻辑与视图的彻底分离。

- **数据访问层 (`stakingProgram-data-access.ts`)**:
    - **分层 Hooks**:
        - `useStakingProgram`: 管理全局状态和管理员操作。
        - `useUserStakeInfo`: 管理当前用户的个人质押数据和操作。
        - `useTokenBalance`: 一个可复用的原子化 Hook，用于查询任意代币的余额。
    - **智能状态管理**: 深度整合 **`TanStack Query`**，自动处理链上数据的**轮询**、**缓存**和**失效**。例如，`poolQuery`
      会定期刷新以更新奖励，而当用户执行 `stake` 操作后，相关的查询会自动失效并重新获取最新数据。

- **UI 组件层 (`stakingProgram-ui.tsx`)**:
    - **条件渲染**: UI 会根据链上状态动态变化。例如，如果 `Pool` 未初始化，则显示初始化表单；如果协议被暂停，则显示全局警告。
    - **上下文感知**: 组件会根据用户身份（是否为管理员）、质押状态（是否在锁仓期）动态显示或禁用相关操作按钮。
    - **提升用户体验 (UX)**:
        - **自动 ATA 创建**: 在用户缺少必要的代币账户时，交易会自动包含创建账户的指令。
        - **精确的金额处理**: 前端负责将用户输入的浮点数精确转换为链上所需的 `BN` 整数格式。
        - **危险操作警告**: 对更改管理员、紧急提款等高风险操作，UI 层面增加了醒目的警告和二次确认。

## 📄 许可证

本项目采用 [MIT 许可证](https://opensource.org/licenses/MIT)。