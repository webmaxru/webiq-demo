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

@description('Optional custom domain bound to the app (e.g. app.example.com). Leave empty to skip. Requires a CNAME to the app FQDN + an asuid TXT record in DNS BEFORE provisioning, so the managed certificate can be issued.')
param customDomain string = ''

@description('Two-phase managed-cert flag. Phase 1 (false): bind the hostname as Disabled so Azure will allow the managed certificate to be created. Phase 2 (true): create the managed cert and switch the binding to SniEnabled. A single pass is impossible (cert needs the hostname; an SNI binding needs the cert).')
param bindCertificate bool = false

var resourceSuffix = take(uniqueString(subscription().id, environmentName, location), 6)
var logAnalyticsName = take('log-${environmentName}-${resourceSuffix}', 63)
var containerRegistryName = take(toLower(replace('cr${environmentName}${resourceSuffix}', '-', '')), 50)
var containerEnvName = take('cae-${environmentName}-${resourceSuffix}', 32)
var containerAppName = take('ca-${environmentName}-${resourceSuffix}', 32)
var managedCertName = empty(customDomain) ? '' : take('mc-${replace(replace(customDomain, '.', '-'), '*', 'wild')}', 32)

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

// Free Azure-managed TLS certificate for the custom domain. Issued via CNAME
// domain-control validation. Azure requires the hostname to already be bound to a
// container app in the environment before the cert can be created, so this is only
// created in phase 2 (bindCertificate = true). The CNAME + asuid TXT records must
// also exist in DNS first.
resource managedCertificate 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' = if (!empty(customDomain) && bindCertificate) {
  parent: containerEnv
  name: managedCertName
  location: location
  tags: tags
  properties: {
    subjectName: customDomain
    domainControlValidation: 'CNAME'
  }
}

// Registry/identity link: the app authenticates to ACR with its system-assigned
// identity (AcrPull granted in acr-pull-role.bicep). Safe to declare at create time
// because the initial image is the PUBLIC placeholder (mcr.microsoft.com) — ACR auth
// is only exercised once the real image is deployed, by which time the role exists.
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
        customDomains: empty(customDomain) ? null : [
          {
            name: customDomain
            bindingType: bindCertificate ? 'SniEnabled' : 'Disabled'
            certificateId: bindCertificate ? managedCertificate.id : null
          }
        ]
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: 'system'
        }
      ]
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
output customDomainUrl string = empty(customDomain) ? '' : 'https://${customDomain}'
