# 基金趋势可视化工具

一款交互式的 Web 应用，旨在帮助用户跟踪、可视化并比较多支投资基金的历史表现。

## 核心功能

- **多基金跟踪**: 通过基金的6位代码，同时添加和监控多支基金。
- **历史数据可视化**: 每支基金的历史单位净值（NAV）都以直观的蓝色折线图形式直接在主表格中展示。
- **Zigzag 趋势线**: 在图表上叠加一条“骨架”折线，用于识别主要市场趋势，忽略微小波动。可以通过“趋势阈值”输入框自定义其灵敏度。该趋势线以一条低调的灰色实线呈现，以帮助聚焦于主要趋势而非干扰视觉。
- **实时估值**: 查看每支基金最新的实时估值和日涨跌幅估算。
- **详细数据表格**: 并排比较所有已跟踪基金的每日净值和增长率。表格还会计算从任一历史节点到最新净值的百分比变化。
- **可调节时间范围**: 轻松更改要显示的历史记录数量（从10条到300条）。
- **详情弹窗视图**: 双击任意基金，即可打开一个包含更大、更清晰性能图表的详细信息弹窗。
- **基金管理**: 在详情弹窗中可以方便地移除不再需要跟踪的基金，并有二次确认步骤防止误删。
- **数据持久化**: 您订阅的基金列表会自动保存在浏览器的本地存储（Local Storage）中，因此您下次访问时选择的基金依然存在。
- **响应式设计**: 界面针对桌面和移动设备进行了优化。

## 如何使用

1.  **添加基金**: 在“基金代码”输入框中输入一个有效的6位基金代码。
2.  **选择记录数**: 从“历史记录”下拉菜单中选择您希望查看的近期历史记录数量。
3.  **设置趋势阈值**: 在“趋势阈值 (%)”输入框中设置一个百分比，用于过滤图表上的短期波动（例如，设置为 `0.5` 意味着只有超过0.5%的波动才会被识别为主要趋势变化）。
4.  **开始跟踪**: 点击“添加基金”按钮。应用将获取基金数据并将其显示在表格中。
5.  **分析对比**: 使用图表、数据列以及 Zigzag 趋势线来比较不同基金的表现。
6.  **查看详情/删除**: 双击第一列中的基金名称以打开详细视图。在这里，您也可以将该基金从订阅列表中删除。
7.  **刷新估值**: 点击“刷新”按钮，可以在不重新加载整个页面的情况下，获取所有已跟踪基金的最新实时估值。

## 技术栈

- **前端框架**: React
- **开发语言**: TypeScript
- **样式**: Tailwind CSS
- **图表库**: Recharts
- **数据获取**: 通过 JSONP 直接请求公开的基金数据 API。

---

## 技术实现细节

本应用采用了一些特定的技术方案来确保功能的稳定和高效。

### 数据结构 (Data Structures)

应用的核心数据围绕以下几个接口进行组织 (`types.ts`):

-   **`FundDataPoint`**: 代表单日的基金历史数据。
    ```typescript
    interface FundDataPoint {
      date: string;              // 日期
      unitNAV: number;           // 单位净值
      cumulativeNAV: number;     // 累计净值
      dailyGrowthRate: string;   // 日增长率 (%)
      subscriptionStatus: string;// 申购状态
      redemptionStatus: string;  // 赎回状态
      dividendDistribution: string; // 分红送配
    }
    ```

-   **`RealTimeData`**: 存储基金的实时估值信息。
    ```typescript
    interface RealTimeData {
      estimatedNAV: number;      // 估算净值
      estimatedChange: string;   // 估算涨跌幅 (%)
      estimationTime: string;    // 估值时间
    }
    ```

-   **`Fund`**: 整合了一支基金的所有信息，包括基本信息、历史数据和实时数据。
    ```typescript
    interface Fund {
      code: string;              // 基金代码
      name: string;              // 基金名称
      data: FundDataPoint[];     // 历史数据点数组
      realTimeData?: RealTimeData; // 可选的实时数据
      latestNAV?: number;         // 最新单位净值
      latestChange?: string;      // 最新日涨跌幅
      color?: string;             // 图表颜色
    }
    ```

### 核心方法 (Core Methods)

#### 数据获取 (`services/fundService.ts`)

由于基金数据 API 存在跨域请求（CORS）限制，本项目采用了 **JSONP** (JSON with Padding) 技术来绕过这些限制，直接从前端获取数据。

-   **`fetchFundDetails`**: 通过 `fundgz.1234567.com.cn` 获取基金的名称和实时估值。它动态创建一个 `<script>` 标签来请求数据。
-   **`fetchFundData`**: 通过 `fund.eastmoney.com` 获取基金的历史净值数据。该函数支持分页，可以根据用户选择的记录数量，自动计算需要请求的页数，并合并结果。

-   **请求序列化**: 为了避免并行请求 JSONP 接口时，全局回调函数（如 `window.jsonpgz`）被覆盖而导致的数据错乱问题，应用为两类请求分别维护了一个全局的 Promise 链（`fundDetailsPromise` 和 `fundDataPagePromise`）。这确保了同一时间只有一个 JSONP 请求在执行，后续的请求会排队等待前一个完成后再发出，从而保证了数据获取的可靠性。

#### 图表工具 (`services/chartUtils.ts`)

-   **`calculateZigzag`**: 这是一个核心算法，用于计算图表上的趋势线。它接收基金净值数据和用户设定的百分比阈值（`deviation`）。算法会遍历数据点，识别出价格反转超过阈值的重要波峰和波谷，然后返回这些关键点的集合，用于绘制“骨架”折线图。

#### 状态管理与数据持久化 (`App.tsx`)

-   **组件状态**: 应用的核心状态由 `App` 组件中的 `useState` Hooks 管理，主要包括 `funds` (存储所有基金对象的数组)、`isLoading` (加载状态)、`error` (错误信息) 等。
-   **数据持久化**:
    -   当应用首次加载时，`useEffect` Hook会尝试从浏览器的 `localStorage` 中读取一个名为 `subscribedFundCodes` 的项目。如果存在，它会获取这些代码对应的基金数据，并恢复用户的上一次会话。
    -   当 `funds` 数组发生变化（例如用户添加或删除了基金）时，另一个 `useEffect` Hook会被触发，它会将当前所有基金的代码组成的数组，以 JSON 字符串的形式写回 `localStorage`，从而实现数据的自动保存。

---
*此 README 文件将随着应用功能的增加而持续更新。*
