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

@description('Minimum always-running replicas (string from azd WEBIQ_MIN_REPLICAS). Empty/"1" (default) keeps one warm replica to avoid cold starts — billed at the reduced Container Apps idle rate while not serving traffic (~$4–5/mo at 0.25 vCPU / 0.5 GiB after the free grant). "0" = scale to zero ($0 idle compute, cold start on the first request after idle).')
param minReplicas string = '1'

@description('Monthly cost-budget amount that triggers spend alerts (string from azd WEBIQ_MONTHLY_BUDGET). Empty defaults to 50. IMPORTANT: Azure Cost Management budgets have NO currency field — the number is interpreted in whatever currency the subscription is billed in. So 50 means 50 NOK only if this subscription bills in NOK; otherwise it is 50 of the subscription\'s billing currency.')
param monthlyBudgetAmount string = '50'

@description('Cost-budget tracking start date (first of a month, yyyy-MM-01). Defaults to the first day of the current UTC month, generated at deploy time. Not normally set by hand.')
param budgetStartDate string = utcNow('yyyy-MM-01')

var tags = {
  'azd-env-name': environmentName
}

// azd substitutes an unset WEBIQ_MONTHLY_BUDGET as '' — fall back to 50.
var budgetAmount = empty(monthlyBudgetAmount) ? 50 : int(monthlyBudgetAmount)

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
    // azd substitutes an unset WEBIQ_MIN_REPLICAS as '' — fall back to one warm replica.
    minReplicas: empty(minReplicas) ? 1 : int(minReplicas)
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

// Subscription-wide cost budget. Drives Azure Cost Management spend alerts: when actual
// or forecasted spend crosses a threshold, Azure notifies the cost action group (which
// targets the subscription Owner role — no personal address stored). Scoped to the whole
// subscription so it catches *all* Azure spend, not just this app's resource group. To
// scope it to only rg-webiq-demo instead, move this resource into modules/resources.bicep
// (which deploys at resource-group scope). Amount is in the subscription's billing
// currency — see the monthlyBudgetAmount param note.
resource costBudget 'Microsoft.Consumption/budgets@2024-08-01' = {
  name: 'budget-${environmentName}'
  properties: {
    category: 'Cost'
    amount: budgetAmount
    timeGrain: 'Monthly'
    timePeriod: {
      // endDate omitted → Azure defaults to 10 years from the start date.
      startDate: budgetStartDate
    }
    notifications: {
      // Early warning at 80% of the budget (e.g. 40 of 50).
      Actual_GreaterThan_80_Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: []
        contactGroups: [
          resources.outputs.costActionGroupId
        ]
      }
      // The requested threshold: fires once actual spend passes 100% of the amount (50).
      Actual_GreaterThan_100_Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: []
        contactGroups: [
          resources.outputs.costActionGroupId
        ]
      }
      // Proactive: fires when the month is *forecast* to exceed the amount.
      Forecasted_GreaterThan_100_Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: []
        contactGroups: [
          resources.outputs.costActionGroupId
        ]
      }
    }
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
output WEBIQ_ABUSE_ALERT_NAME string = resources.outputs.abuseAlertName
output WEBIQ_ABUSE_ACTION_GROUP string = resources.outputs.abuseActionGroupName
output WEBIQ_COST_BUDGET_NAME string = costBudget.name
output WEBIQ_COST_BUDGET_AMOUNT string = string(budgetAmount)
output WEBIQ_COST_ACTION_GROUP string = resources.outputs.costActionGroupName
