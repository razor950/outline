// @flow
import passport from "@outlinewiki/koa-passport";
import Router from "koa-router";
//import { capitalize } from "lodash";
import { Strategy as GithubStrategy } from "passport-github2";
import accountProvisioner from "../../commands/accountProvisioner";
import env from "../../env";
import {
  GitHubOrganizationError,
  GitHubOrganizationAPIError,
} from "../../errors";
import passportMiddleware from "../../middlewares/passport";
//import { getAllowedDomains } from "../../utils/authentication";
import { StateStore } from "../../utils/passport";

const router = new Router();
const providerName = "github";
const GITHUB_CLIENT_ID = process.env.GITHUB_KEY;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_SECRET;

const scopes = [
    "repo",
    "read:org",
    "user",
  ];

export const config = {
  name: "Github",
  enabled: !!GITHUB_CLIENT_ID,
};

export async function request(endpoint: string, accessToken: string) {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  return response.json();
}

if (GITHUB_CLIENT_ID) {
  let strategyOptions = {
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    passReqToCallback: true,
    callbackURL: `${env.URL}/auth/github.callback`,
    store: new StateStore(),
    scope: scopes,
  };

  passport.use(
    new GithubStrategy(strategyOptions, async function (
      req,
      accessToken,
      refreshToken,
      profile,
      done
    ) {
      try {
        //Fetch users Organisations
        const organizationResponse = await request(
          `https://api.github.com/organizations`,
          accessToken
        );
        if (!organizationResponse) {
          throw new GitHubOrganizationAPIError();
        }

        if (!organizationResponse.length) {
          throw new GitHubOrganizationError();
        }

        const organization = organizationResponse[0];

        if (organization.website === "") {
          throw new GitHubOrganizationError();
        }
        //Remove protocol
        //Maybe even remove (www) from the url so the subdomain
        const domain = organization.website.replace(/(^\w+:|^)\/\//, "");

        const subdomain = domain.split(".")[0];
        const teamName = organization.username;

        const result = await accountProvisioner({
          ip: req.ip,
          team: {
            name: organization.username,
            avatarUrl: profile._json.avatar_url,
          },
          user: {
            name: profile.username,
            email: profile.emails[0].value,
            avatarUrl: profile._json.avatar_url,
          },
          authenticationProvider: {
            name: providerName,
            providerId: profile.id,
          },
          authentication: {
            providerId: profile.id,
            accessToken,
            refreshToken,
            scopes,
          },
        });
        return done(null, result.user, result);
      } catch (err) {
        return done(err, null);
      }
    })
  );

  router.get("github", passport.authenticate(providerName));

  router.get("github.callback", passportMiddleware(providerName));
}

export default router;
