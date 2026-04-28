import { feishuRequest, getSpreadsheetToken } from '@/lib/feishu/client'

type PermissionResult = {
  success: boolean
  message: string
}

function getPermissionToken() {
  return process.env.FEISHU_PERMISSION_TOKEN || getSpreadsheetToken()
}

export async function addCollaborator(
  memberType: 'openid' | 'unionid' | 'email' | 'chat',
  memberId: string,
  perm: 'full_access' | 'edit' | 'comment' | 'view' = 'full_access'
): Promise<PermissionResult> {
  const token = getPermissionToken()
  if (!token) return { success: false, message: '未配置 FEISHU_PERMISSION_TOKEN 或 FEISHU_SPREADSHEET_TOKEN' }

  await feishuRequest(`/open-apis/drive/v1/permissions/${token}/members`, {
    method: 'POST',
    body: JSON.stringify({
      member_type: memberType,
      member_id: memberId,
      perm,
      type: 'sheet',
    }),
  })
  return { success: true, message: `已添加协作者：${memberType}:${memberId}` }
}

export async function setLinkShareEditable(): Promise<PermissionResult> {
  const token = getPermissionToken()
  if (!token) return { success: false, message: '未配置 FEISHU_PERMISSION_TOKEN 或 FEISHU_SPREADSHEET_TOKEN' }

  await feishuRequest(`/open-apis/drive/v2/permissions/${token}/public?type=sheet`, {
    method: 'PATCH',
    body: JSON.stringify({
      external_access_entity: 'open',
      security_entity: 'anyone_can_view',
      link_share_entity: 'anyone_editable',
    }),
  })
  return { success: true, message: '已开启链接可编辑分享' }
}

export async function grantAdminPermission(): Promise<PermissionResult> {
  const memberId = process.env.FEISHU_ADMIN_MEMBER_ID
  const memberType = (process.env.FEISHU_ADMIN_MEMBER_TYPE || 'email') as
    | 'openid'
    | 'unionid'
    | 'email'
    | 'chat'

  if (!memberId) {
    return {
      success: false,
      message: '未配置 FEISHU_ADMIN_MEMBER_ID，已跳过管理员授权',
    }
  }

  return addCollaborator(memberType, memberId, 'full_access')
}

