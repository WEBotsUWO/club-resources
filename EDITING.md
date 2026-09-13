# Editing Names, Roles, and Teams

## First-Time Editor Setup

1. Open the [WeBots chart](https://webotsuwo.github.io/club-resources/webots/org-structure/) or [CHRC chart](https://webotsuwo.github.io/club-resources/chrc/org-structure/).
2. Click **Edit chart**.
3. Follow **Create editor token** to GitHub. Create a fine-grained personal access token with resource owner **WEBotsUWO**, repository access **Only select repositories > club-resources**, and repository permission **Contents: Read and write**. Set an expiration appropriate to your role. If the organization requests approval, an organization owner must approve the token.
4. Paste the token into the chart's password field and click **Connect editor**.

The token is sent only to GitHub over HTTPS and held only in the current page's memory. It is not saved in local storage, session storage, the repository, or a URL. Closing or reloading the page requires connecting again. Do not share your token; each editor uses their own account and token.

## Editing

Select a card to edit its role title, person's name, responsibilities, Discord username, Discord user ID, email, department, level, manager, and tags. **Add report** creates a role beneath the selected person. **Remove** moves their direct reports to their manager. Undo and redo apply to your current editing session.

Names may be blank for unassigned roles. Hiring is an independent checkbox, so an assigned person can still be hiring for a replacement or additional support. Senior leadership shows a red Executive badge while retaining the department's color.

For a clickable Discord profile, enable Discord Developer Mode, then use **Copy User ID** on the person's profile and enter that ID. A username alone displays a copy-username icon because Discord profile URLs require a user ID. Email opens the visitor's email app. Enter only contact information intended to be public: both the chart and this repository are public.

Levels run from L6 (president) to L1. Every role must report to a higher-level role. A manager is chosen explicitly because several people can occupy the same level. Invalid level changes and reporting cycles are prevented.

Click **Publish** when finished. This saves the current club's chart to GitHub for everyone. The other club's data is separate. Local drafts are saved automatically but are not public until published. Each update appears in the repository's history under the editor's GitHub account.

If another editor changes the same chart, publishing rejects the stale update. Export your draft, reload the latest chart, and reapply your changes. A failed publish keeps your draft. After reconnecting, a saved draft from the same published revision can be restored; older drafts can be exported without overwriting the latest chart.

## Who Can Edit

An organization or repository administrator manages access in [repository settings](https://github.com/WEBotsUWO/club-resources/settings/access). Grant **Write** access only to people or teams authorized to edit; ordinary members and visitors need no write access. Remove that access to revoke editing. Organization owners and repository administrators inherently retain administrative control.

GitHub enforces permission on every publish request, even if someone changes the page code or URL. The editor's sign-in check uses repository write permission, and the publish request also needs a token with Contents write permission. A read-only token may pass the account check but cannot publish; GitHub rejects it. Protected branches or organization restrictions can also block publishing.

Permissions apply to this entire repository, including both clubs. Separate club folders are not separate security boundaries. Grant access only to editors trusted with both charts. Use separate repositories or a server with per-club authorization if different editor lists become necessary.

The app has no server-side shared password and does not distribute a common admin token. Setup is a scoped GitHub token rather than a one-click social login.

References: [GitHub fine-grained tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [repository roles](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/repository-roles-for-an-organization), [Contents API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents).
