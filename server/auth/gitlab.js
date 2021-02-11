import Router, { type Context } from 'koa-router';
import fetch from 'isomorphic-fetch';
import { mountOAuth2Passport, type DeserializedData } from '../utils/passport';
import { customError } from '../errors';

/*
 * GitLab integration
 * API reference: https://docs.gitlab.com/ce/api/
 */

const gitlabUrl = process.env.GITLAB_URL || 'https://gitlab.com';
const gitlabGroup = process.env.GITLAB_GROUP;
const clientId = process.env.GITLAB_APP_ID;
const clientSecret = process.env.GITLAB_SECRET;

async function deserializeGitlabToken(
  accessToken,
  refreshToken: string
  ): Promise<DeserializedData> {

  const userResponse = await fetch(`${gitlabUrl}/api/v4/user`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) throw new Error('Failed to load user profile.');
  const user = await userResponse.json();

  const groupResponse = await fetch(`${gitlabUrl}/api/v4/groups/${gitlabGroup}?with_projects=false`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!groupResponse.ok) throw new Error('Failed to load group profile.');
  const group = await groupResponse.json();

  return {
      _user: {
          id: user.id.toString(),
          name: user.username,
          email: user.email,
          avatarUrl: user.avatar_url
      },
      _team: {
          id: group.id.toString(),
          name: group.name,
          avatarUrl: group.avatar_url,
      }
  };
}

const router = new Router();
if (clientId && clientSecret) {
  const [authorizeHandler, callbackHandlers] = mountOAuth2Passport(
    'gitlab',
    deserializeGitlabToken,
    {
      clientID: clientId,
      clientSecret: clientSecret,
      tokenURL: `${gitlabUrl}/oauth/token`,
      authorizationURL: `${gitlabUrl}/oauth/authorize`,
      column: 'gitlabId',
      scope: ['openid', 'read_user', 'read_api'],
    }
  );

  router.get('gitlab', authorizeHandler);
  router.get('gitlab.callback', ...callbackHandlers);
}

export default router;
