import { NextRequest, NextResponse } from 'next/server'
import {
  addCollaborator,
  setLinkShareEditable,
  grantAdminPermission,
} from '@/lib/feishu/permission'

/**
 * 飞书权限管理 API
 * POST /api/feishu/permission
 *
 * body:
 * {
 *   action: 'add_collaborator' | 'set_link_share' | 'grant_admin',
 *   memberType?: 'openid' | 'unionid' | 'email' | 'chat',
 *   memberId?: string,
 *   perm?: 'full_access' | 'edit' | 'comment' | 'view',
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, memberType, memberId, perm } = body

    switch (action) {
      case 'add_collaborator': {
        if (!memberType || !memberId) {
          return NextResponse.json(
            { success: false, message: '添加协作者需要提供 memberType 和 memberId' },
            { status: 400 }
          )
        }
        const result = await addCollaborator(memberType, memberId, perm || 'full_access')
        return NextResponse.json(result)
      }

      case 'set_link_share': {
        const result = await setLinkShareEditable()
        return NextResponse.json(result)
      }

      case 'grant_admin': {
        const result = await grantAdminPermission()
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json(
          {
            success: false,
            message:
              `不支持的操作: ${action}。支持: add_collaborator, set_link_share, grant_admin`,
          },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('权限管理失败:', error)
    return NextResponse.json(
      { success: false, message: `操作失败: ${error?.message || String(error)}` },
      { status: 500 }
    )
  }
}

