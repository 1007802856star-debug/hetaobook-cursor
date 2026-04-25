#!/bin/bash
# 智能作业批改系统 - 远程备份脚本
# 使用方法：
#   1. 在 GitHub/Gitee 上创建一个空仓库
#   2. 运行: bash backup-to-remote.sh <仓库地址>
#   示例: bash backup-to-remote.sh https://github.com/yourname/ai-grading.git
#   或:   bash backup-to-remote.sh https://gitee.com/yourname/ai-grading.git

set -e

REMOTE_URL="$1"

if [ -z "$REMOTE_URL" ]; then
    echo "❌ 请提供远程仓库地址"
    echo "用法: bash backup-to-remote.sh <仓库地址>"
    echo "示例: bash backup-to-remote.sh https://github.com/yourname/ai-grading.git"
    exit 1
fi

cd /home/z/my-project

# 检查是否已有 remote
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")

if [ "$CURRENT_REMOTE" = "$REMOTE_URL" ]; then
    echo "✅ 远程仓库已配置: $REMOTE_URL"
else
    if [ -n "$CURRENT_REMOTE" ]; then
        echo "🔄 更新远程仓库地址: $CURRENT_REMOTE → $REMOTE_URL"
        git remote set-url origin "$REMOTE_URL"
    else
        echo "➕ 添加远程仓库: $REMOTE_URL"
        git remote add origin "$REMOTE_URL"
    fi
fi

# 推送所有分支和标签
echo "📦 推送代码到远程仓库..."
git push -u origin --all 2>&1 || {
    echo ""
    echo "⚠️  推送失败，可能原因："
    echo "   1. 仓库地址错误"
    echo "   2. 需要认证（用户名/密码或Token）"
    echo "   3. 仓库不存在（请先在 GitHub/Gitee 上创建空仓库）"
    echo ""
    echo "💡 如果使用 Token 认证，地址格式为："
    echo "   https://<用户名>:<token>@github.com/<用户名>/ai-grading.git"
    echo "   https://<用户名>:<token>@gitee.com/<用户名>/ai-grading.git"
    exit 1
}

# 推送标签（如果有）
git push origin --tags 2>&1 || true

echo ""
echo "✅ 备份完成！所有代码已推送到: $REMOTE_URL"
echo "📊 提交数量: $(git rev-list --count HEAD)"
