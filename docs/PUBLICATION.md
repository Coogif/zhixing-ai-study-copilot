# GitHub Pages 上线记录

日期：2026-10-31，北京时间。用户明确授权「你帮我发布吧」后，创建独立公开仓库并发布；未访问、修改或公开其他仓库。

- [公开源码](https://github.com/Coogif/zhixing-ai-study-copilot)
- [在线演示](https://coogif.github.io/zhixing-ai-study-copilot/)
- [首次成功CI与部署](https://github.com/Coogif/zhixing-ai-study-copilot/actions/runs/41207866846)
- [线上检查结果](../assets/publication-verification.json)

## 发布方式与实际结果

先用已登录的GitHub CLI创建新仓库并推送源码。GitHub连接没有仓库创建/Pages管理接口，且拒绝写入工作流文件，因此通过已登录的GitHub网页编辑器提交已检查的工作流，没有扩大连接权限。Pages采用GitHub Actions，仅部署dist静态白名单。

首次远程流水线的verify和deploy均成功：Linux运行22项单元/语法检查、11项Chromium浏览器回归、构建和发布检查。公开演示不依赖私有服务或模型Key。没有真实模型调用。

## 真实网址验收

2026-10-31 21:59北京时间，在隔离无头Edge中执行`node scripts/verify-live.mjs https://coogif.github.io/zhixing-ai-study-copilot/`：

1. HTTPS首页返回200。
2. 虚构演示数据为8题次、7题覆盖、57%、4题到期。
3. 推荐题s2，错答后显示解析、自评可记录，模型按钮明确禁用。
4. 复习选B纠正后首答率保持50%，刷新保留10题次。
5. 取消重置保留记录，确认重置清空隔离测试记录。
6. practice/review/product的hash路由刷新正常。
7. 320/390px四页面无横向溢出。
8. .env、API实现、开发服务器文件在Pages上返回404。

脚本异常0，桌面页面外部请求0。所有数据为隔离上下文中的测试样本，没有访问个人浏览器历史或学习记录。

[线上桌面截图](../assets/published-desktop.png) · [线上手机截图](../assets/published-mobile.png)。这两张为真实正式网址截图，原有6张本地产品截图另保留来源清单。

## 后续边界

上线并不证明用户价值或教育效果。真实模型质量、用户研究、独立审题、Safari和屏幕阅读器实测仍未执行。任何后续提交都要等待对应CI与部署成功后再宣称该版本已上线。
