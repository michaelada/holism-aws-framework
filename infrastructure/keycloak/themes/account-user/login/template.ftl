<#--
  `displayDescription` exists because this layout is shared by every page
  Keycloak renders, not just the login form — registration, forgotten password
  and the rest come from the parent theme and nest into it too.

  The heading and the standing "enter your email and password" line used to be
  hard-coded here, so a member creating an account was told to sign in, above a
  form with no password to enter yet. The heading now comes from each page's own
  `header` section, and the description only appears where a page asks for it.
-->
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false displayDescription=false>
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}">

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="robots" content="noindex, nofollow">

    <#if properties.meta?has_content>
        <#list properties.meta?split(' ') as meta>
            <meta name="viewport" content="${meta}"/>
        </#list>
    </#if>
    <title>${msg("loginTitle",(realm.displayName!''))}</title>
    <link rel="icon" type="image/png" href="${url.resourcesPath}/img/favicon.png" />

    <#--
      The same two families the account application loads (Roboto for body text,
      Sora for headings). Without them this page falls back to a system sans and
      reads as a different product at exactly the wrong moment — the member has
      just come from the organisation gateway and is about to type a password.
    -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Sora:wght@300;400;500;600;700;800&display=swap"
    />
    <#if properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
</head>

<body class="${properties.kcBodyClass!}">
<#--
  Two columns on a wide screen: the sign-in on the left, the platform's
  announcements on the right. Stacked on a narrow one, sign-in first — somebody
  on a phone is here to sign in, and announcements they have to scroll past to
  reach the password field would be an obstacle rather than a message.

  `data-has-posts` is set by posts.js once something has actually been
  rendered. Until then the shell stays one column, so a deployment with no posts
  looks exactly as it did before this existed rather than showing an empty half
  of a screen.

  See docs/PLATFORM_POSTS.md.
-->
<div class="ips-shell">
<div class="ips-login-col">
<div class="${properties.kcLoginClass!}">
    <div id="kc-header" class="${properties.kcHeaderClass!}">
        <div id="kc-header-wrapper" class="${properties.kcHeaderWrapperClass!}">
            <div class="kc-logo-wrapper">
                <img src="${url.resourcesPath}/img/logo.png" alt="ItsPlainSailing" class="kc-logo" />
            </div>
            ${kcSanitize(msg("loginTitleHtml",(realm.displayNameHtml!'')))?no_esc}
        </div>
    </div>

    <div id="kc-content">
        <div id="kc-content-wrapper">
            <h2 class="kc-account-login-heading"><#nested "header"></h2>

            <#--
              Which club this sign-in is for, filled in by club.js.

              Hidden until it has a name, so a page that cannot work out the
              club — or cannot reach the API — is exactly the page it was
              before rather than one with an empty line in it. The wording is a
              translated template because the theme has its own message bundle;
              `%organisation%` is substituted in JavaScript, as text — not a
              MessageFormat `{0}`, which Keycloak would try to parse itself.
            -->
            <p class="kc-login-club"
               id="ips-club"
               hidden
               data-api-base="${properties.ipsApiBase!''}"
               data-template="${msg("signingInTo")}"></p>
            <#if displayDescription>
                <p class="kc-login-description">${msg("loginDescription")}</p>
            </#if>
            <#if realm.internationalizationEnabled  && locale.supported?size gt 1>
                <div class="${properties.kcLocaleMainClass!}" id="kc-locale">
                    <div id="kc-locale-wrapper" class="${properties.kcLocaleWrapperClass!}">
                        <div id="kc-locale-dropdown" class="${properties.kcLocaleDropDownClass!}">
                            <a href="#" id="kc-current-locale-link">${locale.current}</a>
                            <ul class="${properties.kcLocaleListClass!}">
                                <#list locale.supported as l>
                                    <li class="${properties.kcLocaleListItemClass!}">
                                        <a class="${properties.kcLocaleItemClass!}" href="${l.url}">${l.label}</a>
                                    </li>
                                </#list>
                            </ul>
                        </div>
                    </div>
                </div>
            </#if>

            <#-- App-initiated actions -->
            <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                <div class="alert-${message.type} ${properties.kcAlertClass!} pf-m-<#if message.type = 'error'>danger<#else>${message.type}</#if>">
                    <div class="pf-c-alert__icon">
                        <#if message.type = 'success'><span class="${properties.kcFeedbackSuccessIcon!}"></span></#if>
                        <#if message.type = 'warning'><span class="${properties.kcFeedbackWarningIcon!}"></span></#if>
                        <#if message.type = 'error'><span class="${properties.kcFeedbackErrorIcon!}"></span></#if>
                        <#if message.type = 'info'><span class="${properties.kcFeedbackInfoIcon!}"></span></#if>
                    </div>
                    <span class="${properties.kcAlertTitleClass!}">${kcSanitize(message.summary)?no_esc}</span>
                </div>
            </#if>

            <#nested "form">

            <#if auth?has_content && auth.showTryAnotherWayLink()>
                <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post">
                    <div class="${properties.kcFormGroupClass!}">
                        <input type="hidden" name="tryAnotherWay" value="on"/>
                        <a href="#" id="try-another-way"
                           onclick="document.forms['kc-select-try-another-way-form'].submit();return false;">${msg("doTryAnotherWay")}</a>
                    </div>
                </form>
            </#if>

            <#nested "socialProviders">

            <#if displayInfo>
                <div id="kc-info" class="${properties.kcSignUpClass!}">
                    <div id="kc-info-wrapper" class="${properties.kcInfoAreaWrapperClass!}">
                        <#nested "info">
                    </div>
                </div>
            </#if>
        </div>
    </div>
</div>

    <#--
      Attribution, under the card rather than beside it.

      Inside `.ips-login-col` and after the card, so it sits beneath the form on
      a wide screen and beneath the form on a narrow one too — the column is the
      same element in both layouts, which a footer placed in the shell would not
      have been.

      A new tab, and `rel="noopener"` with it: somebody halfway through filling
      in a registration form should not lose it to a click on a footer.
    -->
    <p class="ips-powered-by">
        <a href="https://itsplainsailing.com" target="_blank" rel="noopener noreferrer">
            <img src="${url.resourcesPath}/img/logo.png" alt="" class="ips-powered-by-logo" />
            <span>${msg("poweredBy")}</span>
        </a>
        <#-- The separator is markup, so a translator is never handed a
             dangling " - " and it can wrap away cleanly on a narrow screen. -->
        <span aria-hidden="true">&ndash;</span>
        <span>${msg("copyright", .now?string('yyyy'))}</span>
    </p>
</div>

<#--
  Filled in by posts.js. `data-api-base` comes from theme.properties and is
  empty in the normal case, where nginx serves Keycloak and the API on one
  origin and a relative path is correct.
-->
<aside class="ips-posts-col"
       id="ips-posts"
       data-surface="account"
       data-api-base="${properties.ipsApiBase!''}"
       aria-label="${msg("announcements")}"></aside>
</div>
</body>
</html>
</#macro>
