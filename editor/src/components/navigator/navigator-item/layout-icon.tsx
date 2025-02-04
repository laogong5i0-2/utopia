import React from 'react'
import type { ElementWarnings, NavigatorEntry } from '../../../components/editor/store/editor-state'
import {
  isInvalidOverrideNavigatorEntry,
  navigatorEntryToKey,
} from '../../../components/editor/store/editor-state'
import type { IcnProps } from '../../../uuiui'
import { colorTheme } from '../../../uuiui'
import { Icn, Icons } from '../../../uuiui'
import { WarningIcon } from '../../../uuiui/warning-icon'
import { invalidGroupStateToString } from '../../canvas/canvas-strategies/strategies/group-helpers'
import { ChildWithPercentageSize } from '../../common/size-warnings'
import { useLayoutOrElementIcon } from '../layout-element-icons'
import { MetadataUtils } from '../../../core/model/element-metadata-utils'
import type { ElementPath } from '../../../core/shared/project-file-types'
import type { ElementInstanceMetadataMap } from '../../../core/shared/element-template'
import { isInfinityRectangle } from '../../../core/shared/math-utils'
import { isZeroSizedElement } from '../../canvas/controls/outline-utils'
import { optionalMap } from '../../../core/shared/optional-utils'
import createCachedSelector from 're-reselect'
import { metadataSelector } from '../../inspector/inpector-selectors'
import type { MetadataSubstate } from '../../editor/store/store-hook-substore-types'
import * as EP from '../../../core/shared/element-path'
import { Substores, useEditorState } from '../../editor/store/store-hook'

interface LayoutIconProps {
  navigatorEntry: NavigatorEntry
  color: IcnProps['color']
  warningText?: string | null
  elementWarnings?: ElementWarnings | null
}

export function layoutIconTestIdForEntry(navigatorEntry: NavigatorEntry): string {
  return `layout-icn-${navigatorEntryToKey(navigatorEntry)}`
}

export function isZeroSizedDiv(elementPath: ElementPath, metadata: ElementInstanceMetadataMap) {
  const bounds = MetadataUtils.getFrameInCanvasCoords(elementPath, metadata)
  if (bounds == null || isInfinityRectangle(bounds)) {
    return false
  }

  const isElementDiv =
    optionalMap(
      (i) => MetadataUtils.isDiv(i),
      MetadataUtils.findElementByElementPath(metadata, elementPath),
    ) ?? false

  return isZeroSizedElement(bounds) && isElementDiv
}

const isZeroSizedDivSelector = createCachedSelector(
  metadataSelector,
  (_: MetadataSubstate, x: ElementPath) => x,
  (metadata, elementPath) => {
    return isZeroSizedDiv(elementPath, metadata)
  },
)((_, x) => EP.toString(x))

export const LayoutIcon: React.FunctionComponent<React.PropsWithChildren<LayoutIconProps>> =
  React.memo((props) => {
    const { elementWarnings, color, warningText: propsWarningText, navigatorEntry } = props
    const { iconProps, isPositionAbsolute } = useLayoutOrElementIcon(navigatorEntry)

    const isZeroSized = useEditorState(
      Substores.metadata,
      (store) => isZeroSizedDivSelector(store, props.navigatorEntry.elementPath),
      'LayoutIcon isZeroSized',
    )

    const warningText = React.useMemo(() => {
      if (elementWarnings == null) {
        return propsWarningText ?? null
      }
      if (elementWarnings.dynamicSceneChildWidthHeightPercentage) {
        return ChildWithPercentageSize
      } else if (elementWarnings.widthOrHeightZero) {
        return 'Missing width or height'
      } else if (elementWarnings.absoluteWithUnpositionedParent) {
        return 'Element is trying to be positioned absolutely with an unconfigured parent. Add absolute or relative position to the parent.'
      } else if (elementWarnings.invalidGroup != null) {
        return invalidGroupStateToString(elementWarnings.invalidGroup)
      } else if (elementWarnings.invalidGroupChild != null) {
        return invalidGroupStateToString(elementWarnings.invalidGroupChild)
      } else {
        return propsWarningText ?? null
      }
    }, [elementWarnings, propsWarningText])

    const isErroredGroup = React.useMemo(
      () => elementWarnings?.invalidGroup != null,
      [elementWarnings],
    )
    const isErroredGroupChild = React.useMemo(
      () => elementWarnings?.invalidGroupChild != null,
      [elementWarnings],
    )

    const iconTestId = React.useMemo(
      () => layoutIconTestIdForEntry(navigatorEntry),
      [navigatorEntry],
    )

    const icon = React.useMemo(() => {
      const defaults = {
        ...iconProps,
        color: color,
        style: { opacity: 'var(--iconOpacity)' },
      }
      if (isZeroSized) {
        return (
          <Icn
            category='element'
            type='zerosized-div'
            testId={iconTestId}
            color={'main'}
            width={18}
            height={18}
          />
        )
      }
      if (isInvalidOverrideNavigatorEntry(navigatorEntry)) {
        return (
          <Icons.WarningTriangle
            color={'overridden'}
            tooltipText={navigatorEntry.message}
            testId={iconTestId}
          />
        )
      } else if (warningText == null) {
        return <Icn {...defaults} testId={iconTestId} />
      } else if (isErroredGroup) {
        return (
          <Icons.GroupProblematic testId={iconTestId} color={color} tooltipText={warningText} />
        )
      } else if (isErroredGroupChild) {
        return <Icn {...defaults} testId={iconTestId} tooltipText={warningText} />
      } else {
        return <WarningIcon tooltipText={warningText} testId={iconTestId} />
      }
    }, [
      iconProps,
      color,
      isZeroSized,
      navigatorEntry,
      warningText,
      isErroredGroup,
      isErroredGroupChild,
      iconTestId,
    ])

    const marker = React.useMemo(() => {
      if (warningText != null && isErroredGroupChild) {
        return (
          <Icons.ExclamationMark
            tooltipText={warningText}
            color={color}
            style={{
              transform: 'scale(1.25)',
            }}
          />
        )
      } else if (isPositionAbsolute) {
        return (
          <div
            style={{
              color: colorTheme.brandNeonPink.value,
              fontSize: 11,
              fontWeight: 600,
              paddingTop: 3,
            }}
          >
            *
          </div>
        )
      } else {
        return null
      }
    }, [isPositionAbsolute, color, warningText, isErroredGroupChild])

    return (
      <div
        style={{
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyItems: 'center',
          position: 'relative',
          transform: 'scale(.8)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            left: -9,
            height: 18,
            width: 8,
          }}
        >
          {marker}
        </div>
        {icon}
      </div>
    )
  })
