/**
 * The members ruling R2 enters as served though no request-shape test pinned
 * them: one call each, over the shipped defaults. `r2RequestShapes.test.ts`
 * holds what each sends.
 */
import type { AdtClient } from '../../../clients/AdtClient';
import { headersOf } from '../../helpers/adtHeaders';

export type R2Call = (client: AdtClient) => Promise<unknown>;

const enhancement = (type: 'enhoxhb' | 'enhsxsb') => ({
  enhancementName: 'ZENH_GUARD',
  enhancementType: type,
});

function enhancementCalls(type: 'enhoxhb' | 'enhsxsb'): [string, R2Call][] {
  const config = enhancement(type);
  return [
    [`${type}.lock`, (c) => c.getEnhancement().lock(config)],
    [`${type}.unlock`, (c) => c.getEnhancement().unlock(config, 'LH')],
    [
      `${type}.activate`,
      (c) => {
        const h = c.getEnhancement();
        return h.activate(config, { headers: headersOf(h, 'activate') });
      },
    ],
    [
      `${type}.check`,
      (c) => {
        const h = c.getEnhancement();
        return h.check(config, undefined, { headers: headersOf(h, 'check') });
      },
    ],
    [`${type}.validate`, (c) => c.getEnhancement().validate(config)],
    [
      `${type}.checkDeletion`,
      (c) => {
        const h = c.getEnhancement();
        return h.checkDeletion(config, {
          headers: headersOf(h, 'checkDeletion'),
        });
      },
    ],
    [
      `${type}.delete`,
      (c) => {
        const h = c.getEnhancement();
        return h.delete(config, { headers: headersOf(h, 'delete') });
      },
    ],
    [`${type}.readTransport`, (c) => c.getEnhancement().readTransport(config)],
    [`${type}.getVersions`, (c) => c.getEnhancement().getVersions(config)],
  ];
}

export const R2_CALLS: [string, R2Call][] = [
  [
    'featureToggle.switchOn',
    (c) =>
      c
        .getFeatureToggle()
        .switchOn(
          { featureToggleName: 'ZFT_GUARD' },
          { transportRequest: 'TRKORR01' },
        ),
  ],
  [
    'featureToggle.switchOff',
    (c) =>
      c
        .getFeatureToggle()
        .switchOff(
          { featureToggleName: 'ZFT_GUARD' },
          { transportRequest: 'TRKORR01', userSpecific: true },
        ),
  ],
  [
    'featureToggle.getRuntimeState',
    (c) =>
      c.getFeatureToggle().getRuntimeState({ featureToggleName: 'ZFT_GUARD' }),
  ],
  [
    'featureToggle.checkState',
    (c) => {
      const h = c.getFeatureToggle();
      return h.checkState({ featureToggleName: 'ZFT_GUARD' }, undefined, {
        headers: headersOf(h, 'checkState'),
      });
    },
  ],
  [
    'featureToggle.readSource',
    (c) =>
      c
        .getFeatureToggle()
        .readSource({ featureToggleName: 'ZFT_GUARD' }, 'inactive'),
  ],
  [
    'serviceBinding.getServiceBindingTypes',
    (c) => c.getServiceBinding().getServiceBindingTypes(),
  ],
  [
    'serviceBinding.getServiceGroup',
    (c) =>
      c.getServiceBinding().getServiceGroup({
        objectname: 'ZSB_GUARD',
        serviceType: 'odatav4',
        servicename: 'ZSRV_GUARD',
        serviceversion: '0001',
        srvdname: 'ZSD_GUARD',
      }),
  ],
  [
    'class.activateTestClasses',
    (c) =>
      c.getClass().activateTestClasses({
        className: 'ZCL_GUARD',
        testClassName: 'LTCL_GUARD',
      }),
  ],
  [
    'messageClassMessage.readMetadata',
    (c) =>
      c
        .getMessageClassMessage()
        .readMetadata({ className: 'ZMSG_GUARD', msgno: '001' }),
  ],
  ...enhancementCalls('enhoxhb'),
  ...enhancementCalls('enhsxsb'),
];
