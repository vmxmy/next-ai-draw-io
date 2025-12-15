"use client"

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"

export type Locale = "en" | "zh-CN"

const STORAGE_LOCALE_KEY = "next-ai-draw-io-locale"

export type I18nKey =
    | "tool.generate"
    | "tool.edit"
    | "tool.analyze"
    | "status.complete"
    | "status.error"
    | "toast.startedFreshChat"
    | "toast.networkError"
    | "toast.autoRetryLimitReached"
    | "toast.editFallbackStopRetry"
    | "toast.copyFailed"
    | "toast.feedbackFailed"
    | "toast.diagramInvalid"
    | "toast.diagramValidationFailed"
    | "toast.diagramProcessFailed"
    | "toast.xmlError.unclosedTag"
    | "toast.xmlError.invalidTag"
    | "toast.xmlError.entityReference"
    | "toast.xmlError.unexpectedChar"
    | "toast.xmlError.prematureEnd"
    | "toast.authFailed"
    | "toast.rateLimited"
    | "toast.quotaExceeded"
    | "toast.modelNotFound"
    | "toast.contextTooLong"
    | "toast.requestTooLarge"
    | "toast.providerPolicy"
    | "toast.upstreamError"
    | "toast.unknownError"
    | "toast.copyDiagnostics"
    | "toast.openSettings"
    | "toast.lastFailureLabel"
    | "toast.autoRetryLimitReachedHint"
    | "dialog.history.title"
    | "dialog.history.empty"
    | "dialog.history.restorePrompt"
    | "dialog.history.cancel"
    | "dialog.history.confirm"
    | "dialog.history.close"
    | "dialog.save.title"
    | "dialog.save.format"
    | "dialog.save.filename"
    | "dialog.save.save"
    | "dialog.save.cancel"
    | "files.rejectedOne"
    | "files.rejectedMany"
    | "files.more"
    | "files.maxFiles"
    | "files.onlyMoreAllowed"
    | "files.unsupportedType"
    | "files.exceedsLimit"
    | "dialog.settings.title"
    | "dialog.settings.description"
    | "settings.accessCode.label"
    | "settings.accessCode.placeholder"
    | "settings.accessCode.save"
    | "settings.accessCode.requiredNote"
    | "settings.accessCode.invalid"
    | "settings.accessCode.verifyFailed"
    | "settings.aiProvider.title"
    | "settings.aiProvider.note"
    | "settings.aiProvider.providerLabel"
    | "settings.aiProvider.useServerDefault"
    | "settings.aiProvider.modelIdLabel"
    | "settings.aiProvider.apiKeyLabel"
    | "settings.aiProvider.apiKeyPlaceholder"
    | "settings.aiProvider.overrides"
    | "settings.aiProvider.baseUrlLabel"
    | "settings.aiProvider.baseUrlPlaceholder"
    | "settings.aiProvider.clear"
    | "settings.tabs.model"
    | "settings.tabs.interface"
    | "settings.tabs.about"
    | "about.title"
    | "about.version"
    | "about.license"
    | "about.licenseDescription"
    | "about.viewLicense"
    | "about.viewNotice"
    | "about.viewCompliance"
    | "about.thirdParty"
    | "about.thirdPartyDescription"
    | "about.components"
    | "about.tweakcn"
    | "about.radixUI"
    | "about.shadcnUI"
    | "about.aiSDK"
    | "about.drawio"
    | "about.nextjs"
    | "about.copyright"
    | "about.repository"
    | "about.documentation"
    | "about.basedOn"
    | "about.originalProject"
    | "settings.theme.label"
    | "settings.theme.note"
    | "settings.themeColor.label"
    | "settings.themeColor.note"
    | "settings.drawioStyle.label"
    | "settings.drawioStyle.note"
    | "settings.drawioStyle.minimal"
    | "settings.drawioStyle.sketch"
    | "settings.drawioStyle.switchTo"
    | "settings.closeProtection.label"
    | "settings.closeProtection.note"
    | "settings.language.label"
    | "settings.language.note"
    | "settings.language.en"
    | "settings.language.zhCN"
    | "chat.placeholder"
    | "chat.tooltip.clear"
    | "chat.tooltip.history"
    | "chat.tooltip.save"
    | "chat.tooltip.undo"
    | "chat.tooltip.redo"
    | "chat.tooltip.upload"
    | "chat.send"
    | "chat.sending"
    | "chat.thinking"
    | "chat.stop"
    | "examples.title"
    | "examples.subtitle"
    | "examples.quick"
    | "examples.cachedNote"
    | "examples.new"
    | "examples.paper.title"
    | "examples.paper.desc"
    | "examples.paper.prompt"
    | "examples.animated.title"
    | "examples.animated.desc"
    | "examples.animated.prompt"
    | "examples.aws.title"
    | "examples.aws.desc"
    | "examples.aws.prompt"
    | "examples.flowchart.title"
    | "examples.flowchart.desc"
    | "examples.flowchart.prompt"
    | "examples.creative.title"
    | "examples.creative.desc"
    | "examples.creative.prompt"
    | "toast.drawioSaved"
    | "canvas.export"
    | "canvas.exportTooltip"
    | "save.filenamePlaceholder"
    | "reset.title"
    | "reset.description"
    | "reset.clearDiagram"
    | "reset.cancel"
    | "reset.clear"
    | "quota.dismiss"
    | "quota.title.request"
    | "quota.title.token"
    | "quota.tip"
    | "quota.body1"
    | "quota.body2"
    | "quota.body3"
    | "quota.learnMore"
    | "quota.selfHost"
    | "quota.sponsor"
    | "quota.byok.title"
    | "quota.byok.description"
    | "chat.header.about"
    | "chat.header.noticeTooltip"
    | "chat.header.newChatTooltip"
    | "chat.header.quotaTooltip"
    | "chat.header.settingsTooltip"
    | "chat.header.hideTooltip"
    | "chat.header.showTooltip"
    | "chat.header.aiChatLabel"
    | "toast.storageUpdateFailed"
    | "toast.imageNotSupported"
    | "diff.change"
    | "diff.remove"
    | "diff.add"
    | "chat.tooltip.copy"
    | "chat.tooltip.copied"
    | "chat.tooltip.regenerate"
    | "chat.tooltip.good"
    | "chat.tooltip.bad"
    | "settings.sessions.title"
    | "settings.sessions.note"
    | "settings.sessions.new"
    | "settings.sessions.empty"
    | "settings.sessions.delete"
    | "settings.sessions.current"
    | "sync.status.ok"
    | "sync.status.okAt"
    | "sync.status.syncing"
    | "sync.status.offline"
    | "sync.status.error"
    | "auth.signIn"
    | "auth.signOut"
    | "auth.profile"
    | "auth.dialog.title"
    | "auth.dialog.description"
    | "auth.dialog.oauth"
    | "auth.dialog.phone"
    | "auth.dialog.continueWithGoogle"
    | "auth.dialog.continueWithGithub"
    | "auth.dialog.secureAuth"
    | "auth.dialog.terms"
    | "auth.dialog.privacy"
    | "auth.dialog.byContining"
    | "auth.dialog.and"
    | "auth.phone.signIn"
    | "auth.phone.signUp"
    | "auth.phone.name"
    | "auth.phone.optional"
    | "auth.phone.phoneNumber"
    | "auth.phone.verificationCode"
    | "auth.phone.sendCode"
    | "auth.phone.sending"
    | "auth.phone.yourName"
    | "auth.phone.signingIn"
    | "auth.phone.signingUp"
    | "auth.phone.codeSent"
    | "auth.phone.codeSentDev"
    | "auth.phone.registrationSuccess"
    | "auth.error.enterPhone"
    | "auth.error.invalidPhone"
    | "auth.error.phoneNotRegistered"
    | "auth.error.phoneInUse"
    | "auth.error.sendCodeFailed"
    | "auth.error.enterCode"
    | "auth.error.codeExpired"
    | "auth.error.codeInvalid"
    | "auth.error.codeUsed"
    | "auth.error.registrationFailed"
    | "auth.error.authFailed"
    | "auth.error.oauthSignin"
    | "auth.error.oauthCallback"
    | "auth.error.oauthCreateAccount"
    | "auth.error.emailCreateAccount"
    | "auth.error.callback"
    | "auth.error.oauthAccountNotLinked"
    | "auth.error.sessionRequired"
    | "auth.error.unknownError"
    | "userCenter.title"
    | "userCenter.description"
    | "userCenter.accountInfo"
    | "userCenter.name"
    | "userCenter.email"
    | "userCenter.phone"
    | "userCenter.signOut"
    | "userCenter.signingOut"
    | "userCenter.tabs.basic"
    | "userCenter.tabs.tier"
    | "userCenter.tier.current"
    | "userCenter.tier.expiresIn"
    | "userCenter.tier.quotaUsage"
    | "userCenter.tier.dailyRequests"
    | "userCenter.tier.dailyTokens"
    | "userCenter.tier.tpmUsage"
    | "userCenter.tier.unlimited"
    | "userCenter.tier.upgradePrompt"
    | "userCenter.tier.upgradeDescription"
    | "settings.aiProvider.modelsLoading"
    | "settings.aiProvider.modelsCount"
    | "settings.aiProvider.modelIdSelectPlaceholder"
    | "settings.aiProvider.modelsHint"
    | "settings.aiProvider.syncToCloud"
    | "settings.aiProvider.syncing"
    | "settings.aiProvider.synced"
    | "settings.aiProvider.restoreFromCloud"
    | "settings.aiProvider.restoring"
    | "settings.aiProvider.restored"
    | "settings.aiProvider.noCloudConfig"
    | "chat.header.sessionSwitcher"
    | "chat.header.newSessionTooltip"
    | "chat.tooltip.edit"
    | "chat.aria.input"
    | "files.removeFile"
    | "common.close"
    | "chat.tooltip.copyMessage"
    | "chat.tooltip.copyFailed"
    | "files.reading"
    | "files.chars"
    | "files.previewAlt"
    | "conversationLimit.title"
    | "conversationLimit.description"
    | "conversationLimit.message"
    | "conversationLimit.options"
    | "conversationLimit.option1"
    | "conversationLimit.option2"
    | "conversationLimit.deleteButton"
    | "conversationLimit.registerButton"
    | "auth.dialog.agreeToTerms"
    | "auth.error.mustAgreeToTerms"

const MESSAGES: Record<Locale, Record<I18nKey, string>> = {
    en: {
        "tool.generate": "Generate Diagram",
        "tool.edit": "Edit Diagram",
        "tool.analyze": "Analyze Diagram",
        "status.complete": "Complete",
        "status.error": "Error",
        "toast.startedFreshChat": "Started a fresh chat",
        "toast.networkError": "Network error. Please check your connection.",
        "toast.autoRetryLimitReached":
            "Auto-retry limit reached. Please try again manually.",
        "toast.editFallbackStopRetry":
            "Precise edits failed repeatedly. Auto-retry stopped; next attempt will regenerate the diagram.",
        "toast.copyFailed":
            "Failed to copy message. Please copy manually or check clipboard permissions.",
        "toast.feedbackFailed":
            "Failed to record your feedback. Please try again.",
        "toast.diagramInvalid":
            "AI generated invalid diagram XML. Please try regenerating.",
        "toast.diagramValidationFailed":
            "Diagram validation failed. Please try regenerating.",
        "toast.diagramProcessFailed":
            "Failed to process diagram. Please try regenerating.",
        "toast.xmlError.unclosedTag":
            "XML error: Unclosed tag detected. Please try regenerating.",
        "toast.xmlError.invalidTag":
            "XML error: Invalid tag structure. Please try regenerating.",
        "toast.xmlError.entityReference":
            "XML error: Invalid entity reference. Please try regenerating.",
        "toast.xmlError.unexpectedChar":
            "XML error: Unexpected character found. Please try regenerating.",
        "toast.xmlError.prematureEnd":
            "XML error: Document ended prematurely. Please try regenerating.",
        "toast.authFailed": "Authentication failed. Please check your API key.",
        "toast.rateLimited": "Too many requests. Please try again later.",
        "toast.quotaExceeded":
            "Insufficient quota or balance. Please check billing/credits.",
        "toast.modelNotFound":
            "Model not found or not accessible. Please check the model ID.",
        "toast.contextTooLong":
            "Context is too long. Please shorten your input or clear history.",
        "toast.requestTooLarge":
            "Request is too large. Please reduce input/files and retry.",
        "toast.providerPolicy":
            "Provider policy blocked this request. Please adjust privacy/policy settings (OpenRouter: https://openrouter.ai/settings/privacy) or switch models.",
        "toast.upstreamError":
            "Upstream provider error. Please retry or switch model/provider.",
        "toast.unknownError": "Unexpected error occurred. Please try again.",
        "toast.copyDiagnostics": "Copy diagnostics",
        "toast.openSettings": "Open settings",
        "toast.lastFailureLabel": "Last failure:",
        "toast.autoRetryLimitReachedHint":
            "Auto-retry is stopped. You can regenerate, copy diagnostics, or adjust settings/model.",
        "dialog.history.title": "Diagram History",
        "dialog.history.empty": "No history available yet.",
        "dialog.history.restorePrompt": "Restore to Version {version}?",
        "dialog.history.cancel": "Cancel",
        "dialog.history.confirm": "Confirm",
        "dialog.history.close": "Close",
        "dialog.save.title": "Save Diagram",
        "dialog.save.format": "Format",
        "dialog.save.filename": "Filename",
        "dialog.save.save": "Save",
        "dialog.save.cancel": "Cancel",
        "files.rejectedOne": "{count} file rejected:",
        "files.rejectedMany": "{count} files rejected:",
        "files.more": "...and {count} more",
        "files.maxFiles": "Maximum {count} files allowed",
        "files.onlyMoreAllowed": "Only {count} more file(s) allowed",
        "files.unsupportedType": '"{name}" is not a supported file type',
        "files.exceedsLimit": '"{name}" is {size} (exceeds {limit}MB)',
        "dialog.settings.title": "Settings",
        "dialog.settings.description": "Configure your application settings.",
        "settings.accessCode.label": "Access Code",
        "settings.accessCode.placeholder": "Enter access code",
        "settings.accessCode.save": "Save",
        "settings.accessCode.requiredNote": "Required to use this application.",
        "settings.accessCode.invalid": "Invalid access code",
        "settings.accessCode.verifyFailed": "Failed to verify access code",
        "settings.aiProvider.title": "AI Provider Settings",
        "settings.aiProvider.note":
            "Use your own API key to bypass usage limits. Your key is stored locally and can optionally be synced to the cloud if you sign in.",
        "settings.aiProvider.providerLabel": "Provider",
        "settings.aiProvider.useServerDefault": "Use Server Default",
        "settings.aiProvider.modelIdLabel": "Model ID",
        "settings.aiProvider.apiKeyLabel": "API Key",
        "settings.aiProvider.apiKeyPlaceholder": "Your API key",
        "settings.aiProvider.overrides": "Overrides {env}",
        "settings.aiProvider.baseUrlLabel": "Base URL (optional)",
        "settings.aiProvider.baseUrlPlaceholder":
            "e.g., https://api.example.com/v1",
        "settings.aiProvider.clear": "Clear Settings",
        "settings.tabs.model": "Model",
        "settings.tabs.interface": "Interface",
        "settings.tabs.about": "About",
        "about.title": "About Next AI Draw.io",
        "about.version": "Version",
        "about.license": "License",
        "about.licenseDescription":
            "This project is licensed under the Apache License 2.0",
        "about.viewLicense": "View LICENSE",
        "about.viewNotice": "View NOTICE",
        "about.viewCompliance": "View Compliance Audit",
        "about.thirdParty": "Third-Party Components",
        "about.thirdPartyDescription":
            "This project uses the following open-source components:",
        "about.components": "Components",
        "about.tweakcn": "Tweakcn theme system (MIT License)",
        "about.radixUI": "Radix UI primitives (MIT License)",
        "about.shadcnUI": "shadcn/ui components (MIT License)",
        "about.aiSDK": "AI SDK by Vercel (Apache 2.0)",
        "about.drawio": "Draw.io integration (Apache 2.0)",
        "about.nextjs": "Next.js framework (MIT License)",
        "about.copyright": "Copyright 2024 Dayuan Jiang",
        "about.repository": "GitHub Repository",
        "about.documentation": "Documentation",
        "about.basedOn": "Based on",
        "about.originalProject": "Original project by Dayuan Jiang",
        "settings.theme.label": "Theme",
        "settings.theme.note":
            "Dark/Light mode for interface and DrawIO canvas.",
        "settings.themeColor.label": "Theme Color",
        "settings.themeColor.note":
            "Choose from official shadcn/ui themes. Customize UI colors.",
        "settings.drawioStyle.label": "DrawIO Style",
        "settings.drawioStyle.note": "Canvas style: {style}",
        "settings.drawioStyle.minimal": "Minimal",
        "settings.drawioStyle.sketch": "Sketch",
        "settings.drawioStyle.switchTo": "Switch to {style}",
        "settings.closeProtection.label": "Close Protection",
        "settings.closeProtection.note":
            "Show confirmation when leaving the page.",
        "settings.language.label": "Language",
        "settings.language.note": "Choose interface language.",
        "settings.language.en": "English",
        "settings.language.zhCN": "简体中文",
        "chat.placeholder": "Describe your diagram or upload a file...",
        "chat.tooltip.clear": "Clear conversation",
        "chat.tooltip.history": "Diagram history",
        "chat.tooltip.save": "Save diagram",
        "chat.tooltip.undo": "Undo",
        "chat.tooltip.redo": "Redo",
        "chat.tooltip.upload": "Upload file (image, PDF, text)",
        "chat.send": "Send",
        "chat.sending": "Sending...",
        "chat.thinking": "Thinking...",
        "chat.stop": "Stop",
        "examples.title": "Create diagrams with AI",
        "examples.subtitle":
            "Describe what you want to create or upload an image to replicate",
        "examples.quick": "Quick Examples",
        "examples.cachedNote": "Examples are cached for instant response",
        "examples.new": "NEW",
        "examples.paper.title": "Paper to Diagram",
        "examples.paper.desc":
            "Upload .pdf, .txt, .md, .json, .csv, .py, .js, .ts and more",
        "examples.paper.prompt": "Summarize this paper as a diagram",
        "examples.animated.title": "Animated Diagram",
        "examples.animated.desc":
            "Draw a transformer architecture with animated connectors",
        "examples.animated.prompt":
            "Give me a **animated connector** diagram of transformer's architecture",
        "examples.aws.title": "AWS Architecture",
        "examples.aws.desc":
            "Create a cloud architecture diagram with AWS icons",
        "examples.aws.prompt": "Replicate this in aws style",
        "examples.flowchart.title": "Replicate Flowchart",
        "examples.flowchart.desc": "Upload and replicate an existing flowchart",
        "examples.flowchart.prompt": "Replicate this flowchart.",
        "examples.creative.title": "Creative Drawing",
        "examples.creative.desc": "Draw something fun and creative",
        "examples.creative.prompt": "Draw a cat for me",
        "toast.drawioSaved": "Diagram saved",
        "canvas.export": "Export",
        "canvas.exportTooltip": "Export diagram",
        "save.filenamePlaceholder": "Enter filename",
        "reset.title": "Clear chat?",
        "reset.description":
            "This will start a new chat session. You can choose whether to also clear the diagram.",
        "reset.clearDiagram": "Also clear diagram",
        "reset.cancel": "Cancel",
        "reset.clear": "Clear",
        "quota.dismiss": "Dismiss",
        "quota.title.request": "Daily Quota Reached",
        "quota.title.token": "Daily Token Limit Reached",
        "quota.tip": "Tip:",
        "quota.body1":
            "Oops — you've reached the daily {type} limit for this demo! As an indie developer covering all the API costs myself, I have to set these limits to keep things sustainable.",
        "quota.body2":
            "You can use your own API key (click the Settings icon) or self-host the project to bypass these limits.",
        "quota.body3": "Your limit resets tomorrow. Thanks for understanding!",
        "quota.learnMore": "Learn more →",
        "quota.selfHost": "Self-host",
        "quota.sponsor": "Sponsor",
        "quota.byok.title": "Using Your Own API Key",
        "quota.byok.description":
            "You are using your own API key, so quota limits do not apply. Your usage is only limited by your provider's rate limits.",
        "chat.header.about": "About",
        "chat.header.noticeTooltip":
            "Due to high usage, I have changed the model to minimax-m2 and added some usage limits. See About page for details.",
        "chat.header.newChatTooltip": "Start fresh chat",
        "chat.header.quotaTooltip": "View quota usage",
        "chat.header.settingsTooltip": "Settings",
        "chat.header.hideTooltip": "Hide chat panel (Ctrl+B)",
        "chat.header.showTooltip": "Show chat panel (Ctrl+B)",
        "chat.header.aiChatLabel": "AI Chat",
        "toast.storageUpdateFailed":
            "Chat cleared but browser storage could not be updated",
        "toast.imageNotSupported": "This model doesn't support image input.",
        "diff.change": "Change {index}",
        "diff.remove": "Remove",
        "diff.add": "Add",
        "chat.tooltip.copy": "Copy response",
        "chat.tooltip.copied": "Copied!",
        "chat.tooltip.regenerate": "Regenerate response",
        "chat.tooltip.good": "Good response",
        "chat.tooltip.bad": "Bad response",
        "settings.sessions.title": "Sessions",
        "settings.sessions.note":
            "Manage local conversation sessions on this device.",
        "settings.sessions.new": "New session",
        "settings.sessions.empty": "No sessions yet.",
        "settings.sessions.delete": "Delete",
        "settings.sessions.current": "Current",
        "sync.status.ok": "Cloud sync enabled",
        "sync.status.okAt": "Synced at {time}",
        "sync.status.syncing": "Syncing…",
        "sync.status.offline": "Offline (will sync when back online)",
        "sync.status.error": "Sync failed (will retry automatically)",
        "auth.signIn": "Sign in with GitHub",
        "auth.signOut": "Sign out",
        "auth.profile": "User Center",
        "auth.dialog.title": "Welcome to AI Draw.io",
        "auth.dialog.description":
            "Sign in to access your diagrams and continue creating",
        "auth.dialog.oauth": "OAuth",
        "auth.dialog.phone": "Phone",
        "auth.dialog.continueWithGoogle": "Continue with Google",
        "auth.dialog.continueWithGithub": "Continue with GitHub",
        "auth.dialog.secureAuth": "Secure Authentication",
        "auth.dialog.terms": "Terms of Service",
        "auth.dialog.privacy": "Privacy Policy",
        "auth.dialog.byContining": "By continuing, you agree to our",
        "auth.dialog.and": "and",
        "auth.phone.signIn": "Sign In",
        "auth.phone.signUp": "Sign Up",
        "auth.phone.name": "Name",
        "auth.phone.optional": "(Optional)",
        "auth.phone.phoneNumber": "Phone Number",
        "auth.phone.verificationCode": "Verification Code",
        "auth.phone.sendCode": "Send Code",
        "auth.phone.sending": "Sending...",
        "auth.phone.yourName": "Your name",
        "auth.phone.signingIn": "Signing in...",
        "auth.phone.signingUp": "Signing up...",
        "auth.phone.codeSent": "Verification code sent to your phone",
        "auth.phone.codeSentDev": "Verification code sent! (Dev: {code})",
        "auth.phone.registrationSuccess":
            "Registration successful! Please sign in.",
        "auth.error.enterPhone": "Please enter your phone number",
        "auth.error.invalidPhone": "Invalid phone number format",
        "auth.error.phoneNotRegistered": "Phone number not registered",
        "auth.error.phoneInUse": "Phone number already registered",
        "auth.error.sendCodeFailed": "Failed to send verification code",
        "auth.error.enterCode": "Please enter verification code",
        "auth.error.codeExpired": "Verification code expired",
        "auth.error.codeInvalid": "Invalid verification code",
        "auth.error.codeUsed": "Verification code already used",
        "auth.error.registrationFailed": "Registration failed",
        "auth.error.authFailed": "Authentication failed",
        "auth.error.oauthSignin": "Error connecting to authentication provider",
        "auth.error.oauthCallback": "Error during authentication callback",
        "auth.error.oauthCreateAccount": "Could not create account",
        "auth.error.emailCreateAccount": "Could not create account with email",
        "auth.error.callback": "Error during callback",
        "auth.error.oauthAccountNotLinked":
            "Email already in use with different provider",
        "auth.error.sessionRequired": "Please sign in to access this page",
        "auth.error.unknownError": "An error occurred during authentication",
        "userCenter.title": "User Center",
        "userCenter.description": "Manage your account and preferences",
        "userCenter.accountInfo": "Account Information",
        "userCenter.name": "Name",
        "userCenter.email": "Email",
        "userCenter.phone": "Phone",
        "userCenter.signOut": "Sign Out",
        "userCenter.signingOut": "Signing out...",
        "userCenter.tabs.basic": "Basic Info",
        "userCenter.tabs.tier": "User Tier",
        "userCenter.tier.current": "Current Tier",
        "userCenter.tier.expiresIn": "Expires",
        "userCenter.tier.quotaUsage": "Quota Usage",
        "userCenter.tier.dailyRequests": "Daily Requests",
        "userCenter.tier.dailyTokens": "Daily Tokens",
        "userCenter.tier.tpmUsage": "Tokens/Minute",
        "userCenter.tier.unlimited": "Unlimited",
        "userCenter.tier.upgradePrompt": "Upgrade to Pro for Higher Limits",
        "userCenter.tier.upgradeDescription":
            "Enjoy higher quotas and priority support with Pro tier.",
        "settings.aiProvider.modelsLoading": "Loading models…",
        "settings.aiProvider.modelsCount": "{count} models",
        "settings.aiProvider.modelIdSelectPlaceholder": "Select a model",
        "settings.aiProvider.modelsHint": "Enter API key to load models",
        "settings.aiProvider.syncToCloud": "Sync to Cloud",
        "settings.aiProvider.syncing": "Syncing...",
        "settings.aiProvider.synced": "Synced",
        "settings.aiProvider.restoreFromCloud": "Restore from Cloud",
        "settings.aiProvider.restoring": "Restoring...",
        "settings.aiProvider.restored": "Restored",
        "settings.aiProvider.noCloudConfig": "No cloud config found",
        "chat.header.sessionSwitcher": "Switch session",
        "chat.header.newSessionTooltip": "New session",
        "chat.tooltip.edit": "Edit message",
        "chat.aria.input": "Chat input",
        "files.removeFile": "Remove file",
        "common.close": "Close",
        "chat.tooltip.copyMessage": "Copy message",
        "chat.tooltip.copyFailed": "Failed to copy",
        "files.reading": "Reading...",
        "files.chars": "{count} chars",
        "files.previewAlt": "Full size preview of uploaded diagram or image",
        "conversationLimit.title": "Conversation Limit Reached",
        "conversationLimit.description":
            "You've reached the maximum number of conversations for anonymous users.",
        "conversationLimit.message":
            "Anonymous users can only create up to 3 conversations. Please choose an option:",
        "conversationLimit.options": "Your options:",
        "conversationLimit.option1":
            "Delete the oldest conversation to continue",
        "conversationLimit.option2":
            "Register an account to get 20 conversations and cloud sync",
        "conversationLimit.deleteButton": "Delete oldest",
        "conversationLimit.registerButton": "Register account",
        "auth.dialog.agreeToTerms":
            "I agree to the Terms of Service and Privacy Policy",
        "auth.error.mustAgreeToTerms":
            "You must agree to the Terms of Service and Privacy Policy to continue",
    },
    "zh-CN": {
        "tool.generate": "生成图表",
        "tool.edit": "编辑图表",
        "tool.analyze": "分析图表",
        "status.complete": "完成",
        "status.error": "错误",
        "toast.startedFreshChat": "已开始新的对话",
        "toast.networkError": "网络错误，请检查连接。",
        "toast.autoRetryLimitReached": "自动重试次数已达上限，请手动重试。",
        "toast.editFallbackStopRetry":
            "精确编辑多次失败，已停止自动重试；下次将改为重绘整个图表。",
        "toast.copyFailed": "复制失败，请手动复制或检查剪贴板权限。",
        "toast.feedbackFailed": "反馈提交失败，请稍后重试。",
        "toast.diagramInvalid": "AI 生成的 XML 无效，请尝试重新生成。",
        "toast.diagramValidationFailed": "图表校验失败，请尝试重新生成。",
        "toast.diagramProcessFailed": "图表处理失败，请尝试重新生成。",
        "toast.xmlError.unclosedTag":
            "XML 错误：检测到未闭合的标签，请尝试重新生成。",
        "toast.xmlError.invalidTag": "XML 错误：标签结构无效，请尝试重新生成。",
        "toast.xmlError.entityReference":
            "XML 错误：实体引用无效，请尝试重新生成。",
        "toast.xmlError.unexpectedChar":
            "XML 错误：发现意外字符，请尝试重新生成。",
        "toast.xmlError.prematureEnd":
            "XML 错误：文档过早结束，请尝试重新生成。",
        "toast.authFailed": "鉴权失败，请检查并更新 API Key。",
        "toast.rateLimited": "请求过于频繁，请稍后重试。",
        "toast.quotaExceeded": "额度不足或余额不足，请检查计费/余额设置。",
        "toast.modelNotFound": "模型不存在或无权访问，请检查模型 ID/权限。",
        "toast.contextTooLong":
            "输入或上下文过长，请缩短内容或清理部分历史记录。",
        "toast.requestTooLarge": "请求过大，请减少输入内容/文件后重试。",
        "toast.providerPolicy":
            "提供商策略限制导致请求被拒绝，请检查隐私/合规设置（OpenRouter：https://openrouter.ai/settings/privacy）或切换模型。",
        "toast.upstreamError": "模型上游服务异常，请重试或切换模型/Provider。",
        "toast.unknownError": "发生未知错误，请重试。",
        "toast.copyDiagnostics": "复制诊断信息",
        "toast.openSettings": "打开设置",
        "toast.lastFailureLabel": "最后失败：",
        "toast.autoRetryLimitReachedHint":
            "已停止自动重试。你可以点击“重新生成”再次尝试，或复制诊断信息进行排查，必要时调整模型/设置。",
        "dialog.history.title": "图表历史",
        "dialog.history.empty": "暂无历史版本。",
        "dialog.history.restorePrompt": "恢复到版本 {version}？",
        "dialog.history.cancel": "取消",
        "dialog.history.confirm": "确认",
        "dialog.history.close": "关闭",
        "dialog.save.title": "保存图表",
        "dialog.save.format": "格式",
        "dialog.save.filename": "文件名",
        "dialog.save.save": "保存",
        "dialog.save.cancel": "取消",
        "files.rejectedOne": "已拒绝 {count} 个文件：",
        "files.rejectedMany": "已拒绝 {count} 个文件：",
        "files.more": "……还有 {count} 个",
        "files.maxFiles": "最多只能上传 {count} 个文件",
        "files.onlyMoreAllowed": "还可再上传 {count} 个文件",
        "files.unsupportedType": "“{name}”不是支持的文件类型",
        "files.exceedsLimit": "“{name}”大小为 {size}（超过 {limit}MB 限制）",
        "dialog.settings.title": "设置",
        "dialog.settings.description": "配置应用相关设置。",
        "settings.accessCode.label": "访问码",
        "settings.accessCode.placeholder": "请输入访问码",
        "settings.accessCode.save": "保存",
        "settings.accessCode.requiredNote": "使用本应用需要访问码。",
        "settings.accessCode.invalid": "访问码无效",
        "settings.accessCode.verifyFailed": "访问码验证失败",
        "settings.aiProvider.title": "AI 提供商设置",
        "settings.aiProvider.note":
            "填写你自己的 API Key 以绕过使用限制。你的 Key 保存在浏览器本地，登录后可选择同步到云端。",
        "settings.aiProvider.providerLabel": "提供商",
        "settings.aiProvider.useServerDefault": "使用服务器默认值",
        "settings.aiProvider.modelIdLabel": "模型 ID",
        "settings.aiProvider.apiKeyLabel": "API Key",
        "settings.aiProvider.apiKeyPlaceholder": "你的 API Key",
        "settings.aiProvider.overrides": "将覆盖 {env}",
        "settings.aiProvider.baseUrlLabel": "Base URL（可选）",
        "settings.aiProvider.baseUrlPlaceholder":
            "例如：https://api.example.com/v1",
        "settings.aiProvider.clear": "清除设置",
        "settings.tabs.model": "模型配置",
        "settings.tabs.interface": "界面配置",
        "settings.tabs.about": "关于",
        "about.title": "关于 Next AI Draw.io",
        "about.version": "版本",
        "about.license": "许可证",
        "about.licenseDescription": "本项目基于 Apache License 2.0 许可证开源",
        "about.viewLicense": "查看 LICENSE",
        "about.viewNotice": "查看 NOTICE",
        "about.viewCompliance": "查看合规性审计报告",
        "about.thirdParty": "第三方组件",
        "about.thirdPartyDescription": "本项目使用了以下开源组件：",
        "about.components": "组件列表",
        "about.tweakcn": "Tweakcn 主题系统 (MIT 许可证)",
        "about.radixUI": "Radix UI 组件库 (MIT 许可证)",
        "about.shadcnUI": "shadcn/ui 组件 (MIT 许可证)",
        "about.aiSDK": "Vercel AI SDK (Apache 2.0 许可证)",
        "about.drawio": "Draw.io 集成 (Apache 2.0 许可证)",
        "about.nextjs": "Next.js 框架 (MIT 许可证)",
        "about.copyright": "版权所有 © 2024 Dayuan Jiang",
        "about.repository": "GitHub 仓库",
        "about.documentation": "文档",
        "about.basedOn": "基于",
        "about.originalProject": "原始项目作者：Dayuan Jiang",
        "settings.theme.label": "主题",
        "settings.theme.note": "切换界面与 DrawIO 画布的明暗模式。",
        "settings.themeColor.label": "主题配色",
        "settings.themeColor.note":
            "从 shadcn/ui 官方主题中选择，自定义界面配色。",
        "settings.drawioStyle.label": "DrawIO 样式",
        "settings.drawioStyle.note": "画布风格：{style}",
        "settings.drawioStyle.minimal": "简洁",
        "settings.drawioStyle.sketch": "手绘",
        "settings.drawioStyle.switchTo": "切换为 {style}",
        "settings.closeProtection.label": "关闭保护",
        "settings.closeProtection.note": "离开页面时弹出确认提示。",
        "settings.language.label": "语言",
        "settings.language.note": "选择界面语言。",
        "settings.language.en": "English",
        "settings.language.zhCN": "简体中文",
        "chat.placeholder": "描述你想要的图表，或上传文件…",
        "chat.tooltip.clear": "清空对话",
        "chat.tooltip.history": "图表历史",
        "chat.tooltip.save": "保存图表",
        "chat.tooltip.undo": "撤销",
        "chat.tooltip.redo": "重做",
        "chat.tooltip.upload": "上传文件（图片 / PDF / 文本）",
        "chat.send": "发送",
        "chat.sending": "发送中…",
        "chat.thinking": "思考中…",
        "chat.stop": "停止",
        "examples.title": "用 AI 创建图表",
        "examples.subtitle": "描述你想创建的内容，或上传图片进行复刻",
        "examples.quick": "快速示例",
        "examples.cachedNote": "示例已缓存，可快速响应",
        "examples.new": "新",
        "examples.paper.title": "论文转图表",
        "examples.paper.desc":
            "支持上传 .pdf、.txt、.md、.json、.csv、.py、.js、.ts 等",
        "examples.paper.prompt": "请把这篇论文总结成一张图表",
        "examples.animated.title": "动画连线示例",
        "examples.animated.desc": "绘制带动画连线的 Transformer 架构图",
        "examples.animated.prompt":
            "请生成一张 Transformer 架构图，连线带动画效果",
        "examples.aws.title": "AWS 架构图",
        "examples.aws.desc": "用 AWS 图标生成云架构图",
        "examples.aws.prompt": "请用 AWS 风格复刻这张架构图",
        "examples.flowchart.title": "复刻流程图",
        "examples.flowchart.desc": "上传并复刻已有流程图",
        "examples.flowchart.prompt": "请复刻这张流程图。",
        "examples.creative.title": "创意绘画",
        "examples.creative.desc": "画点有趣的创意图",
        "examples.creative.prompt": "给我画一只猫",
        "toast.drawioSaved": "图表已保存",
        "canvas.export": "导出",
        "canvas.exportTooltip": "导出图表",
        "save.filenamePlaceholder": "请输入文件名",
        "reset.title": "清空对话？",
        "reset.description":
            "将开始一个新的对话会话。你可以选择是否同时清空图表画布。",
        "reset.clearDiagram": "同时清空图表",
        "reset.cancel": "取消",
        "reset.clear": "清空",
        "quota.dismiss": "关闭",
        "quota.title.request": "已达到每日配额上限",
        "quota.title.token": "已达到每日 Token 上限",
        "quota.tip": "提示：",
        "quota.body1":
            "你已达到本演示的每日 {type} 限制。作为独立开发者我需要控制成本以保证服务可持续。",
        "quota.body2":
            "你可以在设置中填写自有 API Key，或自行部署项目以绕过限制。",
        "quota.body3": "配额将于明天重置，感谢理解！",
        "quota.learnMore": "了解更多 →",
        "quota.selfHost": "自行部署",
        "quota.sponsor": "赞助",
        "quota.byok.title": "正在使用您自己的 API Key",
        "quota.byok.description":
            "您正在使用自己的 API Key，因此不受平台配额限制。您的使用仅受提供商的速率限制约束。",
        "chat.header.about": "关于",
        "chat.header.noticeTooltip":
            "由于使用量较高，我将默认模型切换为 minimax-m2 并加入使用限制，详见 About 页面。",
        "chat.header.newChatTooltip": "新建对话",
        "chat.header.quotaTooltip": "查看配额使用情况",
        "chat.header.settingsTooltip": "设置",
        "chat.header.hideTooltip": "隐藏聊天面板（Ctrl+B）",
        "chat.header.showTooltip": "显示聊天面板（Ctrl+B）",
        "chat.header.aiChatLabel": "AI 聊天",
        "toast.storageUpdateFailed": "对话已清空，但浏览器存储未能更新",
        "toast.imageNotSupported": "当前模型不支持图片输入。",
        "diff.change": "变更 {index}",
        "diff.remove": "删除",
        "diff.add": "新增",
        "chat.tooltip.copy": "复制回复",
        "chat.tooltip.copied": "已复制！",
        "chat.tooltip.regenerate": "重新生成回复",
        "chat.tooltip.good": "有帮助",
        "chat.tooltip.bad": "没帮助",
        "settings.sessions.title": "会话管理",
        "settings.sessions.note": "在本设备本地管理对话会话。",
        "settings.sessions.new": "新建会话",
        "settings.sessions.empty": "暂无会话。",
        "settings.sessions.delete": "删除",
        "settings.sessions.current": "当前",
        "sync.status.ok": "已开启云端同步",
        "sync.status.okAt": "已同步 {time}",
        "sync.status.syncing": "同步中…",
        "sync.status.offline": "离线（恢复网络后将自动同步）",
        "sync.status.error": "同步失败（将自动重试）",
        "auth.signIn": "使用 GitHub 登录",
        "auth.signOut": "退出登录",
        "auth.profile": "个人中心",
        "auth.dialog.title": "欢迎使用 AI Draw.io",
        "auth.dialog.description": "登录以访问您的图表并继续创作",
        "auth.dialog.oauth": "OAuth",
        "auth.dialog.phone": "手机",
        "auth.dialog.continueWithGoogle": "使用 Google 继续",
        "auth.dialog.continueWithGithub": "使用 GitHub 继续",
        "auth.dialog.secureAuth": "安全认证",
        "auth.dialog.terms": "服务条款",
        "auth.dialog.privacy": "隐私政策",
        "auth.dialog.byContining": "继续即表示您同意我们的",
        "auth.dialog.and": "和",
        "auth.phone.signIn": "登录",
        "auth.phone.signUp": "注册",
        "auth.phone.name": "姓名",
        "auth.phone.optional": "（可选）",
        "auth.phone.phoneNumber": "手机号",
        "auth.phone.verificationCode": "验证码",
        "auth.phone.sendCode": "发送验证码",
        "auth.phone.sending": "发送中...",
        "auth.phone.yourName": "您的姓名",
        "auth.phone.signingIn": "登录中...",
        "auth.phone.signingUp": "注册中...",
        "auth.phone.codeSent": "验证码已发送到您的手机",
        "auth.phone.codeSentDev": "验证码已发送！（开发模式：{code}）",
        "auth.phone.registrationSuccess": "注册成功！请登录。",
        "auth.error.enterPhone": "请输入手机号",
        "auth.error.invalidPhone": "手机号格式无效",
        "auth.error.phoneNotRegistered": "手机号未注册",
        "auth.error.phoneInUse": "手机号已被注册",
        "auth.error.sendCodeFailed": "发送验证码失败",
        "auth.error.enterCode": "请输入验证码",
        "auth.error.codeExpired": "验证码已过期",
        "auth.error.codeInvalid": "验证码无效",
        "auth.error.codeUsed": "验证码已被使用",
        "auth.error.registrationFailed": "注册失败",
        "auth.error.authFailed": "认证失败",
        "auth.error.oauthSignin": "连接认证提供商时出错",
        "auth.error.oauthCallback": "认证回调时出错",
        "auth.error.oauthCreateAccount": "无法创建账号",
        "auth.error.emailCreateAccount": "无法使用邮箱创建账号",
        "auth.error.callback": "回调时出错",
        "auth.error.oauthAccountNotLinked": "该邮箱已被其他提供商使用",
        "auth.error.sessionRequired": "请登录以访问此页面",
        "auth.error.unknownError": "认证时发生错误",
        "userCenter.title": "个人中心",
        "userCenter.description": "管理您的账号和偏好设置",
        "userCenter.accountInfo": "账号信息",
        "userCenter.name": "姓名",
        "userCenter.email": "邮箱",
        "userCenter.phone": "手机",
        "userCenter.signOut": "退出登录",
        "userCenter.signingOut": "退出中...",
        "userCenter.tabs.basic": "基础信息",
        "userCenter.tabs.tier": "用户等级",
        "userCenter.tier.current": "当前等级",
        "userCenter.tier.expiresIn": "过期时间",
        "userCenter.tier.quotaUsage": "配额使用情况",
        "userCenter.tier.dailyRequests": "每日请求数",
        "userCenter.tier.dailyTokens": "每日 Token 数",
        "userCenter.tier.tpmUsage": "每分钟 Token 数",
        "userCenter.tier.unlimited": "无限制",
        "userCenter.tier.upgradePrompt": "升级到专业版以获得更高限额",
        "userCenter.tier.upgradeDescription":
            "专业版用户享受更高配额和优先支持。",
        "settings.aiProvider.modelsLoading": "正在加载模型列表…",
        "settings.aiProvider.modelsCount": "共 {count} 个模型",
        "settings.aiProvider.modelIdSelectPlaceholder": "选择一个模型",
        "settings.aiProvider.modelsHint": "填写 API Key 后可加载模型列表",
        "settings.aiProvider.syncToCloud": "同步到云端",
        "settings.aiProvider.syncing": "同步中...",
        "settings.aiProvider.synced": "已同步",
        "settings.aiProvider.restoreFromCloud": "从云端恢复",
        "settings.aiProvider.restoring": "恢复中...",
        "settings.aiProvider.restored": "已恢复",
        "settings.aiProvider.noCloudConfig": "未找到云端配置",
        "chat.header.sessionSwitcher": "切换会话",
        "chat.header.newSessionTooltip": "新建会话",
        "chat.tooltip.edit": "编辑消息",
        "chat.aria.input": "聊天输入框",
        "files.removeFile": "移除文件",
        "common.close": "关闭",
        "chat.tooltip.copyMessage": "复制消息",
        "chat.tooltip.copyFailed": "复制失败",
        "files.reading": "读取中…",
        "files.chars": "{count} 字符",
        "files.previewAlt": "上传的图表或图片的全尺寸预览",
        "conversationLimit.title": "会话数量已达上限",
        "conversationLimit.description":
            "您已达到匿名用户可创建的会话数量上限。",
        "conversationLimit.message":
            "匿名用户最多只能创建 3 个会话，请选择一个选项：",
        "conversationLimit.options": "您的选择：",
        "conversationLimit.option1": "删除最旧的会话以继续",
        "conversationLimit.option2": "注册账户获得 20 个会话额度和云端同步",
        "conversationLimit.deleteButton": "删除最旧会话",
        "conversationLimit.registerButton": "注册账户",
        "auth.dialog.agreeToTerms": "我同意服务条款和隐私政策",
        "auth.error.mustAgreeToTerms": "您必须同意服务条款和隐私政策才能继续",
    },
}

function detectLocale(): Locale {
    if (typeof window === "undefined") return "en"
    const stored = localStorage.getItem(STORAGE_LOCALE_KEY)
    if (stored === "en" || stored === "zh-CN") return stored
    const lang = navigator.language.toLowerCase()
    if (lang.startsWith("zh")) return "zh-CN"
    return "en"
}

function formatMessage(
    template: string,
    vars?: Record<string, string | number>,
) {
    if (!vars) return template
    return template.replace(/\{(\w+)\}/g, (_, k) =>
        vars[k] === undefined ? `{${k}}` : String(vars[k]),
    )
}

interface I18nContextValue {
    locale: Locale
    setLocale: (l: Locale) => void
    t: (key: I18nKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>("en")

    useEffect(() => {
        setLocaleState(detectLocale())
    }, [])

    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.lang = locale === "zh-CN" ? "zh-CN" : "en"
        }
    }, [locale])

    const setLocale = useCallback((l: Locale) => {
        setLocaleState(l)
        try {
            localStorage.setItem(STORAGE_LOCALE_KEY, l)
        } catch {
            // ignore
        }
    }, [])

    const t = useCallback(
        (key: I18nKey, vars?: Record<string, string | number>) => {
            const template = MESSAGES[locale][key] || MESSAGES.en[key] || key
            return formatMessage(template, vars)
        },
        [locale],
    )

    const value = useMemo(
        () => ({ locale, setLocale, t }),
        [locale, setLocale, t],
    )

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
    const ctx = useContext(I18nContext)
    if (!ctx) throw new Error("useI18n must be used within I18nProvider")
    return ctx
}
