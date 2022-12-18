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
const GITHUB = "github";
const scopes = [
  "user:email",
];

export const config = {
  name: "GitHub",
  enabled: !!env.GITHUB_CLIENT_ID,
};

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
          // "company" is the company field in the user's GitHub profile
          const company = profile._json.company;
          const team = await getTeamFromContext(ctx);
          const client = getClientFromContext(ctx);

          // No profile company means personal GitHub account
          // No team implies the request came from the apex domain
          // This combination is always an error
          if (!company && !team) {
            const userExists = await User.count({
              where: { email: profile._json.email.toLowerCase() },
            });

            // Users cannot create a team with personal GitHub accounts
            if (!userExists) {
              throw GitHubAccountCreationError();
            }

            // To log-in with a personal account, users must specify a team subdomain
            throw TeamDomainRequiredError();
          }

          // remove the TLD and form a subdomain from the remaining
          // subdomains of the form "foo.bar.com" are allowed as company names on GitHub
          const subdomain = company ? slugifyDomain(company) : "";
          const teamName = capitalize(subdomain);

          // Request a larger size profile picture than the default by tweaking
          // the query parameter.
          const avatarUrl = profile._json.avatar_url.replace("=s96-c", "=s128-c");

          // if a team can be inferred, we assume the user is only interested in signing into
          // that team in particular; otherwise, we will do a best effort at finding their account
          // or provisioning a new one (within AccountProvisioner)
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
            service: GITHUB,
            serviceId: profile.id,
            accessToken,
            refreshToken,
          });

          return done(null, result.user, { ...result, client });
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  router.get("github", passport.authenticate(GITHUB));
  router.get("github.callback", passportMiddleware(GITHUB));
}

export default router;