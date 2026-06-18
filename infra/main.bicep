targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the azd environment — used to derive resource names and tags.')
param environmentName string

@minLength(1)
@description('Primary Azure region for all resources.')
param location string

@secure()
@description('Web IQ API key. Supplied by azd from the WEBIQ_API_KEY environment variable; stored as a Container App secret.')
param webiqApiKey string

@description('Optional custom domain to bind (e.g. webiq.example.com). Supplied by azd from WEBIQ_CUSTOM_DOMAIN. Requires DNS records (CNAME + asuid TXT) to exist before provisioning.')
param customDomain string = ''

@description('Two-phase managed-cert flag (string from azd WEBIQ_BIND_CERT). "false"/empty = phase 1 (bind hostname as Disabled). "true" = phase 2 (issue cert + SniEnabled).')
param bindCertificate string = 'false'

@description('Optional email address for the rate-limit alert. Supplied by azd from WEBIQ_ALERT_EMAIL. When empty, no action group or alert rule is created.')
param alertEmailAddress string = ''

var tags = {
  'azd-env-name': environmentName
}

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

// Core resources: Log Analytics, ACR, Container Apps env, and the app.
module resources './modules/resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    tags: tags
    environmentName: environmentName
    webiqApiKey: webiqApiKey
    customDomain: customDomain
    bindCertificate: toLower(bindCertificate) == 'true'
    alertEmailAddress: alertEmailAddress
  }
}

// Phase 2: grant the app's managed identity AcrPull on the registry.
// Separate module to avoid a circular dependency with the container app.
module acrPullRole './modules/acr-pull-role.bicep' = {
  name: 'acrPullRole'
  scope: rg
  params: {
    acrName: resources.outputs.containerRegistryName
    principalId: resources.outputs.containerAppPrincipalId
  }
}

output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.containerRegistryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = resources.outputs.containerRegistryName
output AZURE_LOG_ANALYTICS_WORKSPACE_ID string = resources.outputs.logAnalyticsWorkspaceId
output SERVICE_APP_NAME string = resources.outputs.containerAppName
output SERVICE_APP_URI string = resources.outputs.containerAppUri
output WEBIQ_APP_URL string = resources.outputs.containerAppUri
output WEBIQ_CUSTOM_DOMAIN_URL string = resources.outputs.customDomainUrl
output WEBIQ_APPLICATIONINSIGHTS_NAME string = resources.outputs.applicationInsightsName
output WEBIQ_RATE_LIMIT_ALERT_ENABLED bool = resources.outputs.rateLimitAlertEnabled
