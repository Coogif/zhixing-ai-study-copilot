# 验证记录 v0.2

日期：2026-10-31，北京时间。Windows / Node v24.22.1；浏览器为已安装的无头Microsoft Edge（Chromium内核156.0.4314.50）。所有自动浏览器上下文均隔离，只使用构造的样例记录。

## 本次实际执行

| 阶段 | 命令 | 结果 |
|---|---|---|
| 原始ZIP基线 | 3个源码`node --check`；`node --test tests/*.test.mjs` | 6/6 |
| 第一阶段 | `node scripts/check.mjs`；生成preview | 21/21；成功 |
| 第二阶段 | 同上；`node --test tests/e2e/*.test.mjs` | 21/21 + 9/9 |
| 第三阶段 | 同上；`node scripts/capture.mjs` | 21/21 + 9/9；6张真实截图 |
| 第四阶段 | `node scripts/check.mjs`；浏览器测试；静态构建；发布检查 | 22/22 + 11/11；构建与检查通过 |

本环境只有Node，最初没有npm可执行文件，因此没有将`npm test`写成本次实际命令。测试依赖通过内置pnpm入口从npm官方注册表安装，锁定Playwright 1.62.1。核心运行和单元检查无需这些依赖。

## 覆盖范围

- 原有首答/覆盖/复习规则及新增：新题饥饿、已纠错优先级、同毫秒作答、复习结束不混题、全库覆盖结束。
- 本地记录：null/非法JSON、未知题、伪造对错与知识点、负/未来时间、存储禁止、清除失败提示。
- 接口：请求方法、形状、JSON类型、同源、长度、服务未启用、上游失败/空输出；输入仅题号和选项。
- 真实浏览器闭环：空总览 → 演示 → 推荐 → 错答 → 自评/反馈 → 错题复测 → 首答不变 → 刷新 → 取消重置 → 确认重置。
- 320/390/768px × 总览/练习/复习/产品四页面无横向溢出；选项高度≥44px。桌面1440px截图视觉检查。平板折叠导航保留文字无障碍名称。
- 异步旧AI返回不能覆盖同题的新答案（响应替身，不是真实模型）。
- HTTP私有路径、Windows反斜杠、外部Host/Origin、HEAD。
- 实际`dist`在`/portfolio/`仓库子路径的加载、作答、刷新、复习与产品页面；没有API服务仍能使用。
- 实际`file://`离线文件的加载演示、答题、复习、清空；不发生HTTP请求。

首次浏览器测试失败源于测试选择器重复和fetch设置Host的方式，修正测试后通过；详见AUDIT，不将初跑失败隐去。

## 性能与安全证据

静态子路径测试的关键HTML/CSS/四个JS源码合计64,903字节（约63.4KiB，未压缩）；本地烟雾检查0个外部请求。图片只用于文档，不加载到学习界面。预算100KiB用于控制原型复杂度，不是生产加载耗时或Lighthouse分数。

安全检查：常见密钥格式扫描、禁止环境文件、静态产物白名单和本地Markdown链接检查。脚本不输出疑似密钥内容。扫描不能证明没有所有形式的敏感信息；没有任何Git历史可供历史泄漏检查。本轮没有真实Key、模型付费调用或个人学习记录。

## 复现

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm verify:release
```

Windows使用已安装Edge；其他系统用Playwright Chromium。端到端测试自动用最新源码重建preview与dist，启动随机loopback端口，在测试后关闭。截图另执行`pnpm screenshots`。受限沙箱可能需要允许本地套接字和浏览器子进程。

## 尚未验证

真实OpenAI模型输出、教学正确性评测、真实用户任务/效果、iOS/Safari/Firefox、屏幕阅读器实测、低端手机/弱网性能、生产负载、GitHub Actions远程执行、公网Pages。没有声称完整无障碍合规、全量安全审计或用户增长。

## 2026-10-31 线上补充验收

用户授权发布后，首次GitHub Actions在Linux完成22项单元检查、11项Chromium浏览器测试并部署成功。正式HTTPS网址的8组冒烟检查通过，含完整闭环、刷新/重置、320/390px四页面及私有路径404。脚本异常0、桌面外部页面请求0，详细证据见[PUBLICATION](PUBLICATION.md)。这不包含真实模型、真实用户或教育效果评测。上文的「未验证公网Pages/远程Actions」是发布前记录，现已由本段更新。
