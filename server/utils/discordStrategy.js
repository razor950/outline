// @flow
import util from 'util';
import { OAuth2Strategy } from 'passport-oauth';

function Strategy(options: any, verify: Function) {
  options = options || {};
  options.tokenURL =
    options.tokenURL || 'https://discordapp.com/api/oauth2/token';
  options.authorizationURL =
    options.authorizationURL || 'https://discordapp.com/api/oauth2/authorize';
  options.scope = options.scope || [
    'identify',
    'email',
    'connections',
    'guilds',
  ];

  OAuth2Strategy.call(this, options, verify);
  this.name = options.name || 'discord';
  this._profile_url = 'https://discordapp.com/api/users/@me';
  this._profile_guilds = 'https://discordapp.com/api/users/@me/guilds';
  this._load_teams = options.scope.indexOf('guilds') !== -1;
}

util.inherits(Strategy, OAuth2Strategy);

Strategy.prototype.get = async function(url, token): Promise<string> {
  return new Promise((resolve, reject) => {
    this._oauth2._request(
      'GET',
      url,
      {
        authorization: `Bearer ${token}`,
      },
      '',
      token,
      (err, body, res) => {
        if (err) {
          return reject(err);
        }
        resolve(body);
      }
    );
  });
};

Strategy.prototype.userProfile = async function(
  accessToken: string,
  done: (err: ?Error, data?: any) => void
) {
  let user;
  try {
    let userData = await this.get(this._profile_url, accessToken);
    user = JSON.parse(userData);
  } catch (e) {
    return done(e);
  }

  let guilds;
  try {
    let guildsData = await this.get(this._profile_guilds, accessToken);
    guilds = JSON.parse(guildsData);
  } catch (e) {
    return done(e);
  }

  done(null, {
    user: user,
    guilds: guilds,
  });
};

export default Strategy;
