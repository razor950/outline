import passport from "@outlinewiki/koa-passport";
import type { Context } from "koa";
import Router from "koa-router";
import { capitalize } from "lodash";
import { Profile } from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { slugifyDomain } from "@shared/utils/domains";
import accountProvisioner from "@server/commands/accountProvisioner";
import env from "@server/env";
import {
  GitHubAccountCreationError,
  TeamDomainRequiredError,
} from "@server/errors";
import passportMiddleware from "@server/middlewares/passport";
import { User } from "@server/models";
import { AuthenticationResult } from "@server/types";
import {
  StateStore,
  getTeamFromContext,
  getClientFromContext,
} from "@server/utils/passport";

const router = new Router();
const providerName = "github";
const scopes = [
  "user:email",
];

type GitHubProfile = Profile & {
  _json: {
    email?: string;
    avatar_url?: string;
    company?: string;
  };
};

if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        callbackURL: `${env.URL}/auth/github.callback`,
        passReqToCallback: true,
        // @ts-expect-error StateStore
        store: new StateStore(),
        scope: scopes,
      },
      async function (
        ctx: Context,
        accessToken: string,
        refreshToken: string,
        params: {},
        profile: GitHubProfile,
        done: (
          err: Error | null,
          user: User | null,
          result?: AuthenticationResult
        ) => void
      ) {
        try {
          const company = profile._json.company;
          const team = await getTeamFromContext(ctx);
          const client = getClientFromContext(ctx);

          if (!company && !team) {
            const userExists = await User.count({
              where: { email: profile._json.email.toLowerCase() },
            });

            if (!userExists) {
              throw GitHubAccountCreationError();
            }

            throw TeamDomainRequiredError();
          }

          const subdomain = company ? slugifyDomain(company) : "";
          const teamName = capitalize(subdomain);
          const avatarUrl = profile._json.avatar_url.replace("=s96-c", "=s128-c");

          const result = await accountProvisioner({
            ip: ctx.ip,
            team: {
              teamId: team?.id,
              name: teamName,
              domain: company,
              subdomain,
            },
            client,
            user: {
              email: profile._json.email.toLowerCase(),
              avatarUrl,
              name: profile.displayName,
            },
            authenticationProvider: {
              name: providerName,
              providerId: company ?? "",
            },
            authentication: {
              providerId: profile.id,
              accessToken,
              refreshToken,
              scopes,
            },
          });

          return done(null, result.user, { ...result, client });
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  router.get(
    "github",
    passport.authenticate(providerName)
  );

  router.get("github.callback", passportMiddleware(providerName));
}

export default router;
