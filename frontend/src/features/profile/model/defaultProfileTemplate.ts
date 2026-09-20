export const defaultCustomProfileMarkdown = `<style>
.profile-lab {
  display: grid;
  gap: 28px;
  padding: 24px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(22, 119, 255, 0.08) 1px, transparent 1px),
    linear-gradient(rgba(22, 119, 255, 0.07) 1px, transparent 1px),
    #fff;
  background-size: 28px 28px;
}

.profile-hero {
  display: grid;
  gap: 18px;
  min-height: 280px;
  align-content: center;
  position: relative;
  overflow: hidden;
}

.profile-hero::after {
  content: "";
  position: absolute;
  inset: auto 0 22px 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #1677ff, #2e8b57, transparent);
  animation: scan-line 3.2s ease-in-out infinite;
}

.profile-kicker {
  width: fit-content;
  border: 1px solid rgba(22, 119, 255, 0.25);
  border-radius: 999px;
  padding: 7px 10px;
  background: rgba(22, 119, 255, 0.08);
  color: #1677ff;
  font: 700 12px/1 "JetBrains Mono", ui-monospace, monospace;
}

.profile-title {
  max-width: 760px;
  margin: 0;
  color: #1d2939;
  font-size: clamp(34px, 7vw, 72px);
  line-height: 0.98;
}

.profile-title span {
  color: #1677ff;
}

.profile-lead {
  max-width: 660px;
  margin: 0;
  color: #667085;
  font-size: 15px;
  line-height: 1.8;
}

.orbit {
  position: absolute;
  right: 18px;
  top: 28px;
  display: grid;
  width: 158px;
  aspect-ratio: 1;
  place-items: center;
  border: 1px dashed rgba(22, 119, 255, 0.45);
  border-radius: 50%;
  animation: rotate 9s linear infinite;
}

.orbit::before,
.orbit::after {
  content: "";
  position: absolute;
  width: 12px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #1677ff;
  box-shadow: 0 0 0 7px rgba(22, 119, 255, 0.12);
}

.orbit::before {
  top: -6px;
}

.orbit::after {
  bottom: -6px;
  background: #2e8b57;
  box-shadow: 0 0 0 7px rgba(46, 139, 87, 0.12);
}

.orbit-core {
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fff;
  padding: 13px 14px;
  color: #1d2939;
  font: 700 13px/1 "JetBrains Mono", ui-monospace, monospace;
  animation: counter-rotate 9s linear infinite;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid #e4e7ec;
  background: rgba(255, 255, 255, 0.72);
}

.stat {
  padding: 18px;
  border-right: 1px solid #e4e7ec;
}

.stat:last-child {
  border-right: 0;
}

.stat strong {
  display: block;
  color: #1d2939;
  font-size: 28px;
  line-height: 1;
}

.stat span {
  display: block;
  margin-top: 7px;
  color: #667085;
  font: 700 11px/1 "JetBrains Mono", ui-monospace, monospace;
  text-transform: uppercase;
}

.node-chain {
  display: grid;
  gap: 14px;
}

.node {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
  padding: 16px;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  animation: rise 0.7s ease both;
}

.node:nth-child(2) { animation-delay: 0.08s; }
.node:nth-child(3) { animation-delay: 0.16s; }
.node:nth-child(4) { animation-delay: 0.24s; }

.dot {
  width: 12px;
  aspect-ratio: 1;
  margin-top: 5px;
  border-radius: 50%;
  background: #1677ff;
  box-shadow: 0 0 0 6px rgba(22, 119, 255, 0.12);
}

.dot.locked {
  background: #2e8b57;
  box-shadow: 0 0 0 6px rgba(46, 139, 87, 0.12);
}

.node h3 {
  margin: 0;
  color: #1d2939;
  font-size: 15px;
}

.node p {
  margin: 6px 0 0;
  color: #667085;
  font-size: 13px;
  line-height: 1.7;
}

.tag {
  border: 1px solid rgba(22, 119, 255, 0.22);
  border-radius: 999px;
  padding: 6px 9px;
  color: #1677ff;
  font: 700 11px/1 "JetBrains Mono", ui-monospace, monospace;
}

@keyframes scan-line {
  0%, 100% { transform: translateX(-18%); opacity: 0.28; }
  50% { transform: translateX(18%); opacity: 1; }
}

@keyframes rotate {
  to { transform: rotate(360deg); }
}

@keyframes counter-rotate {
  to { transform: rotate(-360deg); }
}

@keyframes rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 720px) {
  .profile-lab { padding: 18px; }
  .orbit { position: relative; right: auto; top: auto; width: 118px; }
  .stats { grid-template-columns: 1fr; }
  .stat { border-right: 0; border-bottom: 1px solid #e4e7ec; }
  .stat:last-child { border-bottom: 0; }
  .node { grid-template-columns: 18px minmax(0, 1fr); }
  .tag { grid-column: 2; width: fit-content; }
}
</style>

<section class="profile-lab">
  <div class="profile-hero">
    <div class="profile-kicker">EXECG / PUBLIC GRAPH</div>
    <h1 class="profile-title">把真实推进，锁进一条<span>可审查的链</span>。</h1>
    <p class="profile-lead">我用节点记录每一次行动，用智能合约检查目标和证据。完成不是一句自我感觉良好，而是一段推进路径被公开锁定。</p>
    <div class="orbit" aria-hidden="true">
      <div class="orbit-core">AI 合约</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><strong>12</strong><span>Locked records</span></div>
    <div class="stat"><strong>4</strong><span>Public projects</span></div>
    <div class="stat"><strong>37</strong><span>Active days</span></div>
  </div>

  <div class="node-chain">
    <div class="node">
      <span class="dot"></span>
      <div>
        <h3>研究做菜：番茄牛腩稳定复现</h3>
        <p>把“做出一道菜”拆成食材用量、火候、复盘变量和下一轮试验。</p>
      </div>
      <span class="tag">推进中</span>
    </div>
    <div class="node">
      <span class="dot locked"></span>
      <div>
        <h3>基础食谱锁定</h3>
        <p>AI 审查通过：用量、步骤、关键时长和证据记录满足项目合约。</p>
      </div>
      <span class="tag">已锁定</span>
    </div>
    <div class="node">
      <span class="dot"></span>
      <div>
        <h3>分叉：牛腩口感变量</h3>
        <p>新增一条路径，对比焯水、浸泡、压力锅和慢炖的影响。</p>
      </div>
      <span class="tag">分叉</span>
    </div>
  </div>
</section>
`
