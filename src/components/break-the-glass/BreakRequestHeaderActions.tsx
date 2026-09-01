import { ActionButton } from '@kinvolk/headlamp-plugin/lib/components/common';
import { breakRequestIsReviewable } from './breakRequestHelpers';
import { openBreakRequestReviewActivity } from './BreakRequestReviewActivity';

function actionResource(props: any) {
  let resource = props.item || props.resource;
  if (resource?.item && !resource.jsonData && !resource.kind) resource = resource.item;
  return resource;
}

export function BreakRequestReviewAction(props: any) {
  const resource = actionResource(props);
  if (!breakRequestIsReviewable(resource)) return null;

  return (
    <ActionButton
      buttonStyle={props.buttonStyle}
      color="primary"
      description="Review BreakRequest"
      longDescription="Inspect resulting changes, adjust approval timing, and submit a verdict"
      icon="mdi:clipboard-check-outline"
      onClick={() => {
        openBreakRequestReviewActivity(resource);
        props.closeMenu?.();
      }}
    />
  );
}

export default BreakRequestReviewAction;
