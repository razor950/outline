// @flow
import Router from 'koa-router';
import addMonths from 'date-fns/add_months';
import { authorize } from '../utils/authorize';
import { User, Team } from '../models';
import DiscordStrategy from '../utils/discordStrategy';
import passport from 'koa-passport';

passport.use(
  new DiscordStrategy(
    {
      authorizationURL: 'https://discordapp.com/api/oauth2/authorize',
      tokenURL: 'https://discordapp.com/api/oauth2/token',
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/auth/discord.callback',
      scope: ['identify', 'email', 'guilds'],
      name: 'discord',
    },
    async (accessToken, refreshToken, data, done) => {
      const guild: ?{ id: string, name: string, icon: string } = (guilds =>
        guilds.length > 0 ? guilds[0] : null)(data.guilds.filter(g => g.owner));
      if (!guild) {
        return done(new Error('User not Owner of any Guild'));
      }

      const [team, isFirstUser] = await Team.findOrCreate({
        where: {
          discordId: guild.id,
        },
        defaults: {
          name: guild.name,
        },
      });

      const [user] = await User.findOrCreate({
        where: {
          service: "discord",
          serviceId: data.user.id,
          teamId: team.id,
        },
        defaults: {
          name: data.user.username,
          email: data.user.email,
          isAdmin: isFirstUser,
        },
      });

      if (isFirstUser) {
        await team.provisionFirstCollection(user.id);
      }

      done(null, user);
    }
  )
);

const router = new Router();

router.get('discord', passport.authenticate('discord'));
router.get('discord.callback', async ctx => {
  let user: User;
  try {
    user = (await authorize('discord', ctx)).User;
  } catch (e) {
    ctx.redirect('/?notice=auth-error');
    return;
  }

  user.updateSignedIn(ctx.request.ip);
  ctx.cookies.set('lastSignedIn', 'discord', {
    httpOnly: false,
    expires: new Date('2100'),
  });
  ctx.cookies.set('accessToken', user.getJwtToken(), {
    httpOnly: false,
    expires: addMonths(new Date(), 1),
  });

  ctx.redirect('/');
});

export default router;
