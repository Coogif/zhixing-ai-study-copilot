# 发布到独立新 GitHub 仓库

当前项目已发布：[公开仓库](https://github.com/Coogif/zhixing-ai-study-copilot) · [在线演示](https://coogif.github.io/zhixing-ai-study-copilot/) · [本次上线记录](PUBLICATION.md)。只处理当前项目，未访问或改变其他仓库。下文作为后续复现指南，已发布的仓库无需重复新建。

## 1. 发布前本地检查

使用Node.js24与锁定的pnpm依赖，执行：

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
pnpm verify:release
```

Windows测试使用已安装的Edge；Linux/CI使用安装的Chromium。核心本地服务和离线文件本身不需要pnpm依赖。安全扫描只匹配常见格式，不等同于全面安全审计；还需人工检查待提交文件名与内容。

确认只包含本项目和原创样例，不含`.env`、个人作答历史、商业题库、未授权材料或密钥。不要修改原有私人仓库的可见性。

## 2. 新建独立仓库并检查远程地址

GitHub中创建空的公开新仓库，建议名`zhixing-ai-study-copilot`，不要初始化README。本项目已按用户授权完成创建；仅在发布自己的新副本时重复本节。

在当前项目目录执行以下命令；`YOUR_ACCOUNT`必须替换为你实际的新仓库账号：

```bash
git status --short
git branch -M main
git add README.md index.html preview.html styles.css src api scripts tests docs assets .github .gitignore .env.example package.json pnpm-lock.yaml
git diff --cached --stat
git diff --cached --check
git commit -m "Prepare verifiable learning assistant portfolio"
git remote add origin https://github.com/YOUR_ACCOUNT/zhixing-ai-study-copilot.git
git remote -v
```

**先核对origin确实指向新仓库，再执行推送：**

```bash
git push -u origin main
```

如果已有origin，先核对并确认，不能照抄命令覆盖其他仓库地址。当前目录已建立提交并关联本项目远程地址；发布副本前应重新核对。

网页上传容易漏掉隐藏的`.github`与锁文件，优先用Git。不要上传node_modules、.cache、dist或测试缓存。`dist`由CI生成。

## 3. GitHub Pages 使用 Actions

在新仓库Settings → Pages → Build and deployment中，将Source设为 **GitHub Actions**。

工作流`.github/workflows/check.yml`执行依赖安装、语法/规则、浏览器、静态构建和发布安全检查。任一失败均不部署；PR只检查，main分支通过后才上传`dist/`并部署到github-pages环境。没有配置模型Key，也不需要私有服务。

若第一次推送时Pages尚未启用，Configure Pages步骤可能失败；启用后到Actions重新运行该工作流。不要将未实际运行的CI写成已通过。

参考实现依据：[GitHub自定义Pages工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Playwright持续集成](https://playwright.dev/docs/ci)。实际动作版本已按本次官方文档核对；后续变更依赖应重新测试。

## 4. 上线验收（本次已执行，后续发布需复验）

从成功部署任务获取**真实URL**，然后逐项确认：

- 根页面以及直接打开/刷新`#practice`、`#review`、`#product`可用，资源子路径无404。
- 加载虚构数据 → 解释推荐 → 做题 → 自评 → 复习 → 刷新 → 重置正常。
- 手机上查看题干和底部导航；核心按钮方便操作。
- 模型按钮明确未启用；无需密钥、登录或后端；无非预期外部请求。
- `.env`、API实现和开发脚本未进入Pages产物。
- 更新README与仓库About中的实际演示地址，保留验证日期与已知限制。

本地已测试仓库子路径和静态文件，仍不能代替真实GitHub Actions及公网验收。不要填写猜测的Pages网址作为已发布链接。

## 5. 后续回滚

上线后若发现问题，先回退当前项目的对应提交或修复后重新走CI；不要用清空其他仓库或改变旧仓库公开性来处理。浏览器学习记录只在当前域名/浏览器，不会随仓库发布上传。
