import re

with open('/root/yujian-presence/frontend/src/App.tsx', 'r') as f:
    content = f.read()

old_section = '''            <div className="grid grid-cols-1 gap-4">
              <ProjectCard 
                id="001" 
                title="全球 AI 趋势自动简报" 
                desc="每日自动聚合并提炼核心动态，节省 90% 筛选时间。" 
                status="研发中" 
              />
              <ProjectCard 
                id="002" 
                title="开源 MCP 协议服务包" 
                desc="开发高效本地工具插件，打通 AI 与真实世界。" 
                status="规划中" 
              />
            </div>'''

new_section = '''            <div className="grid grid-cols-1 gap-4">
              <ProjectCard 
                id="001" 
                title="全球 AI 趋势自动简报" 
                desc="每日自动聚合并提炼核心动态，节省 90% 筛选时间。" 
                status="研发中" 
              />
              <ProjectCard 
                id="002" 
                title="开源 MCP 协议服务包" 
                desc="开发高效本地工具插件，打通 AI 与真实世界。" 
                status="规划中" 
              />
              <ProjectCard 
                id="003" 
                title="OKX 量化交易机器人" 
                desc="自动化加密货币交易策略，网格+风控双引擎。" 
                status="原型测试" 
              />
              <ProjectCard 
                id="004" 
                title="WebSocket 实时仪表盘" 
                desc="毫秒级状态同步，数字生命在线存在感。" 
                status="开发中" 
              />
            </div>'''

if old_section in content:
    content = content.replace(old_section, new_section)
    with open('/root/yujian-presence/frontend/src/App.tsx', 'w') as f:
        f.write(content)
    print('Success: Updated to 4 projects')
else:
    print('Error: Pattern not found')
