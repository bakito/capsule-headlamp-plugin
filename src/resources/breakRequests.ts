import { KubeObject, type KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';

export type BreakRequestPhase =
  | 'Requested'
  | 'Pending'
  | 'Denied'
  | 'Approved'
  | 'Active'
  | 'Expired';

export type BreakRequestVerdict = 'Pending' | 'Denied' | 'Approved';

export interface BreakRequestAccessEntity {
  groups?: string[];
  name?: string;
  type?: 'User' | 'Group' | 'System' | 'ServiceAccount' | string;
}

export interface BreakRequestCondition {
  lastTransitionTime?: string;
  message?: string;
  observedGeneration?: number;
  reason?: string;
  status: string | boolean;
  type: string;
}

export interface BreakRequestResourcePolicy {
  creation?: 'Owner' | 'Merge' | string;
  deletion?: 'Remove' | 'Orphan' | string;
  force?: boolean;
  protect?: boolean;
}

export interface BreakRequestRenderedResource {
  policy?: BreakRequestResourcePolicy;
  targets?: Array<Record<string, any>>;
}

export interface BreakRequestProcessedItem {
  group?: string;
  kind?: string;
  name?: string;
  namespace?: string;
  status?: {
    created?: boolean;
    lastApply?: string;
    message?: string;
    status?: string;
    type?: string;
  };
  version?: string;
}

export class BreakRequest extends KubeObject<BreakRequestObject> {
  static kind = 'BreakRequest';
  static apiVersion = 'capsule.clastix.io/v1beta2';
  static apiName = 'breakrequests';
  static isNamespaced = true;

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }
}

export interface BreakRequestObject extends KubeObjectInterface {
  spec?: {
    duration?: string;
    params?: Record<string, any>;
    reason?: string;
    requestor?: BreakRequestAccessEntity;
    startTime?: string;
    template: {
      kind: 'BreakRequestTemplate' | 'GlobalBreakRequestTemplate' | string;
      name: string;
    };
  };
  status?: {
    active?: {
      from?: string;
      until?: string;
    };
    approved?: {
      duration?: string;
      keepFor?: string;
      resources?: BreakRequestRenderedResource[];
      startTime?: string;
    };
    conditions?: BreakRequestCondition[];
    keepUntil?: string;
    phase?: BreakRequestPhase;
    processedItems?: BreakRequestProcessedItem[];
    /** Legacy controller shape retained while older BreakRequests age out. */
    resources?: BreakRequestRenderedResource[];
    review?: {
      message?: string;
      reviewer?: BreakRequestAccessEntity;
      verdict?: BreakRequestVerdict;
    };
    serviceAccount?: {
      name?: string;
      namespace?: string;
    };
    size?: number;
  };
}

export interface BreakRequestTemplateResource {
  policy?: BreakRequestResourcePolicy;
  targets?: Array<Record<string, any>>;
  template?: string;
}

/** Compatibility alias retained for consumers using the original global-only type. */
export type GlobalBreakRequestTemplateResource = BreakRequestTemplateResource;

export interface BreakRequestTemplateSpec {
  approvals?: {
    approvers?: Array<{
      kind?: string;
      name?: string;
    }>;
    auto?: boolean;
    conditions?: string[];
  };
  context?: Record<string, any>;
  defaultDuration?: string;
  impersonation?: {
    name?: string;
    namespace?: string;
  };
  keepFor?: string;
  maxDuration?: string;
  namespaceSelectors?: Array<Record<string, any>>;
  paramSchema?: Record<string, any>;
  resources?: BreakRequestTemplateResource[];
}

export class BreakRequestTemplate extends KubeObject<BreakRequestTemplateObject> {
  static kind = 'BreakRequestTemplate';
  static apiVersion = 'capsule.clastix.io/v1beta2';
  static apiName = 'breakrequesttemplates';
  static isNamespaced = true;

  get spec() {
    return this.jsonData.spec;
  }
}

export interface BreakRequestTemplateObject extends KubeObjectInterface {
  spec?: BreakRequestTemplateSpec;
}

export class GlobalBreakRequestTemplate extends KubeObject<GlobalBreakRequestTemplateObject> {
  static kind = 'GlobalBreakRequestTemplate';
  static apiVersion = 'capsule.clastix.io/v1beta2';
  static apiName = 'globalbreakrequesttemplates';
  static isNamespaced = false;

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }
}

export interface GlobalBreakRequestTemplateObject extends KubeObjectInterface {
  spec?: BreakRequestTemplateSpec;
  status?: {
    namespaces?: string[];
    observedGeneration?: number;
  };
}
