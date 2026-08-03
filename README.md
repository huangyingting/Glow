# 霁光 JIGUANG

一个面向中国境内的朝霞、晚霞机会预报产品。它通过 Next.js 展示 ECMWF IFS、CMA GRAPES 与 CAMS 大气成分数据，并用透明的启发式模型估算未来七天的霞光机会和置信度。

## 本地运行

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。默认数据源通过 Open-Meteo 接入，不需要 API Key。

## 验证

```bash
npm run check
```

该命令依次执行 ESLint、TypeScript、模型单元测试和生产构建。要继续运行真实天气 API、桌面交互与 390px 手机端浏览器验收：

```bash
npm run verify
```

## 模型如何工作

- 中云和高云提供可被低角度阳光染色的“画布”，但全晴并不等于高分。
- 低云会阻断地平线附近的光路，是权重最大的负面因素之一。
- 降水、湿度和能见度约束实际观测条件。
- CAMS 气溶胶光学厚度与 PM₂.₅ 用于识别适量散射和过量灰霾。
- ECMWF 与 CMA 分别独立评分；两者分歧越大、预报时间越远，置信度越低。
- 缺失值会降低数据完整度，不会自动被当成“完美条件”。

这个结果应理解为“观测机会指数”，不是经历史实拍样本校准的气象概率，也不替代官方天气预报和灾害预警。更完整的数据源调研见 [`docs/data-research.md`](docs/data-research.md)。

## 结构

- `app/api/forecast/route.ts`：中国坐标校验与 API 输出
- `lib/weather.ts`：多源数据获取、时间窗口聚合、降级处理
- `lib/glow-model.ts`：可独立测试的朝晚霞评分模型
- `components/glow-dashboard.tsx`：城市搜索、定位、地图和趋势交互
