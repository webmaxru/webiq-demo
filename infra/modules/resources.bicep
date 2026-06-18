targetScope = 'resourceGroup'

@description('Primary Azure region for all resources.')
param location string

@description('Tags applied to all resources.')
param tags object = {}

@minLength(1)
@maxLength(64)
@description('Name of the azd environment — used to derive resource names.')
param environmentName string

@secure()
@description('Web IQ API key, stored as a Container App secret and exposed to the app as WEBIQ_API_KEY.')
param webiqApiKey string

@description('Logical azd service name. Must match the service key in azure.yaml.')
param serviceName string = 'app'

@description('Container ingress/target port. Must match the port the server listens on.')
param targetPort int = 8080

// Cost note: scale-to-zero (minReplicas 0) means no compute charge while idle.
@minValue(0)
@description('Minimum replicas. 0 = scale to zero (no idle compute cost).')
param minReplicas int = 0

@minValue(1)
@description('Maximum replicas under load.')
param maxReplicas int = 3

var resourceSuffix = take(uniqueString(subscription().id, environmentName, location), 6)
var logAnalyticsName = take('log-${environmentName}-${resourceSuffix}', 63)
var containerRegistryName = take(toLower(replace('cr${environmentName}${resourceSuffix}', '-', '')), 50)
var containerEnvName = take('cae-${environmentName}-${resourceSuffix}', 32)
var containerAppName = take('ca-${environmentName}-${resourceSuffix}', 32)

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    // Keep ingestion/retention minimal for a low-cost demo.
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: containerRegistryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

// Consumption-only environment: no workloadProfiles block => no idle base cost.
resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerEnvName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// No `registries` block here on purpose: azd deploy runs
// `az containerapp registry set --identity system` and updates the image
// via the Azure API after provisioning. The AcrPull role (separate module)
// authorizes the system-assigned identity to pull.
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  tags: union(tags, { 'azd-service-name': serviceName })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerEnv.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'webiq-api-key'
          value: webiqApiKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: serviceName
          // Placeholder until azd pushes the real image; ingress/targetPort
          // are fixed at provision time and matched by the runtime app.
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: string(targetPort)
            }
            {
              name: 'WEBIQ_API_KEY'
              secretRef: 'webiq-api-key'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: targetPort
              }
              initialDelaySeconds: 5
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: targetPort
              }
              initialDelaySeconds: 3
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output containerRegistryName string = containerRegistry.name
output containerRegistryLoginServer string = containerRegistry.properties.loginServer
output containerAppName string = containerApp.name
output containerAppPrincipalId string = containerApp.identity.principalId
output containerAppUri string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output logAnalyticsWorkspaceId string = logAnalytics.id
