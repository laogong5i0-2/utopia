import React from 'react'
import { MetadataUtils } from '../../../core/model/element-metadata-utils'
import type { CanvasRectangle } from '../../../core/shared/math-utils'
import { isInfinityRectangle } from '../../../core/shared/math-utils'
import type { ElementPath } from '../../../core/shared/project-file-types'
import type { IndexPosition } from '../../../utils/utils'
import { useColorTheme } from '../../../uuiui/styles/theme'
import { openFloatingInsertMenu } from '../../editor/actions/action-creators'
import { useDispatch } from '../../editor/store/dispatch-context'
import { Substores, useEditorState } from '../../editor/store/store-hook'
import type { SiblingPosition } from '../canvas-strategies/strategies/reparent-helpers/reparent-strategy-sibling-position-helpers'
import {
  getSiblingMidPointPosition,
  siblingAndPseudoPositions,
} from '../canvas-strategies/strategies/reparent-helpers/reparent-strategy-sibling-position-helpers'
import { CanvasOffsetWrapper } from './canvas-offset-wrapper'

export const InsertionButtonOffset = 10

interface ButtonControlProps {
  identifier: string
  scale: number
  positionX: number
  positionY: number
  lineEndX: number
  lineEndY: number
  isHorizontalLine: boolean
  parentPath: ElementPath
  indexPosition: IndexPosition
}

export const InsertionControls: React.FunctionComponent = React.memo(
  (): React.ReactElement | null => {
    const isInteractionActive = useEditorState(
      Substores.canvas,
      (store) => store.editor.canvas.interactionSession != null,
      'DistanceGuidelineControl isInteractionActive',
    )
    const selectedViews = useEditorState(
      Substores.selectedViews,
      (store) => store.editor.selectedViews,
      'InsertionControls selectedViews',
    )
    const jsxMetadata = useEditorState(
      Substores.metadata,
      (store) => store.editor.jsxMetadata,
      'InsertionControls jsxMetadata',
    )

    const pathTrees = useEditorState(
      Substores.metadata,
      (store) => store.editor.elementPathTree,
      'InsertionControls pathTrees',
    )

    const scale = useEditorState(
      Substores.canvas,
      (store) => store.editor.canvas.scale,
      'InsertionControls scale',
    )
    if (selectedViews.length !== 1 || isInteractionActive) {
      return null
    }
    const selectedView = selectedViews[0]
    const parentPath = selectedView
    const parentFrame =
      parentPath != null ? MetadataUtils.getFrameInCanvasCoords(parentPath, jsxMetadata) : null

    const parentElement = MetadataUtils.findElementByElementPath(jsxMetadata, selectedView)
    if (
      parentPath == null ||
      parentFrame == null ||
      isInfinityRectangle(parentFrame) ||
      parentElement == null ||
      parentElement.specialSizeMeasurements.flexDirection == null
    ) {
      return null
    }

    if (MetadataUtils.findLayoutSystemForChildren(jsxMetadata, pathTrees, parentPath) !== 'flex') {
      return null
    }

    const { direction, forwardOrReverse } = MetadataUtils.getSimpleFlexDirection(parentElement)

    const children = MetadataUtils.getChildrenOrdered(jsxMetadata, pathTrees, parentPath)
    let controlProps: ButtonControlProps[] = []

    const siblingPositions: Array<SiblingPosition> = siblingAndPseudoPositions(
      direction,
      forwardOrReverse,
      parentFrame,
      children.map((m) => m.elementPath),
      jsxMetadata,
    )

    function getBetweenChildrenPosition(index: number): number {
      const precedingSiblingPosition: CanvasRectangle = siblingPositions[index].frame
      const succeedingSiblingPosition: CanvasRectangle = siblingPositions[index + 1].frame
      return getSiblingMidPointPosition(
        precedingSiblingPosition,
        succeedingSiblingPosition,
        direction,
        forwardOrReverse,
      )
    }

    if (children.length > 0) {
      for (let index = 0; index < siblingPositions.length - 1; index++) {
        const insertionIndex = siblingPositions[index].index
        const positionX =
          direction == 'vertical'
            ? parentFrame.x - InsertionButtonOffset
            : getBetweenChildrenPosition(index)
        const positionY =
          direction == 'vertical'
            ? getBetweenChildrenPosition(index)
            : parentFrame.y - InsertionButtonOffset

        const lineEndX =
          direction == 'vertical'
            ? parentFrame.x + parentFrame.width
            : getBetweenChildrenPosition(index)
        const lineEndY =
          direction == 'vertical'
            ? getBetweenChildrenPosition(index)
            : parentFrame.y + parentFrame.height
        controlProps.push({
          identifier: `control-${index}`,
          scale: scale,
          positionX: positionX,
          positionY: positionY,
          lineEndX: lineEndX,
          lineEndY: lineEndY,
          isHorizontalLine: direction === 'vertical',
          parentPath: parentPath,
          indexPosition: {
            type: 'absolute',
            index: insertionIndex,
          },
        })
      }
    } else {
      const positionX =
        direction == 'vertical' ? parentFrame.x - InsertionButtonOffset : parentFrame.x
      const positionY =
        direction == 'vertical' ? parentFrame.y : parentFrame.y - InsertionButtonOffset

      const lineEndX = direction == 'vertical' ? parentFrame.x + parentFrame.width : parentFrame.y
      const lineEndY = direction == 'vertical' ? parentFrame.x : parentFrame.y + parentFrame.height
      controlProps.push({
        identifier: `control-0`,
        scale: scale,
        positionX: positionX,
        positionY: positionY,
        lineEndX: lineEndX,
        lineEndY: lineEndY,
        isHorizontalLine: direction === 'vertical',
        parentPath: parentPath,
        indexPosition: {
          type: 'absolute',
          index: 0,
        },
      })
    }

    return (
      <CanvasOffsetWrapper>
        {controlProps.map((control) => {
          return <InsertionButtonContainer {...control} key={control.identifier} />
        })}
      </CanvasOffsetWrapper>
    )
  },
)

const InsertionButtonContainer = React.memo((props: ButtonControlProps) => {
  const [plusVisible, setPlusVisible] = React.useState(false)

  const onMouseEnter = () => setPlusVisible(true)
  const onMouseLeave = () => setPlusVisible(false)

  return (
    <div
      key={props.identifier}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        left: props.positionX,
        top: props.positionY,
      }}
    >
      {plusVisible ? (
        <>
          <Line {...props} />
          <PlusButton {...props} />
        </>
      ) : (
        <BlueDot {...props} />
      )}
    </div>
  )
})

export const BlueDotSize = 7
const BlueDot = React.memo((props: ButtonControlProps) => {
  const colorTheme = useColorTheme()
  return (
    <div
      style={{
        position: 'absolute',
        left: -BlueDotSize / 2,
        top: -BlueDotSize / 2,
        backgroundColor: 'white',
        width: BlueDotSize,
        height: BlueDotSize,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${1 / props.scale})`,
      }}
      data-testid={`blue-dot-${props.identifier}`}
    >
      <div
        style={{
          width: BlueDotSize - 2 / props.scale,
          height: BlueDotSize - 2 / props.scale,
          backgroundColor: colorTheme.canvasSelectionPrimaryOutline.value,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </div>
  )
})

const PlusButton = React.memo((props: ButtonControlProps) => {
  const dispatch = useDispatch()
  const colorTheme = useColorTheme()
  const { parentPath, indexPosition } = props
  const insertElement: React.MouseEventHandler<HTMLDivElement> = React.useCallback(
    (event) => {
      event.stopPropagation()
      event.preventDefault()
      dispatch(
        [
          openFloatingInsertMenu({
            insertMenuMode: 'insert',
            parentPath: parentPath,
            indexPosition: indexPosition,
          }),
        ],
        'canvas',
      )
    },
    [dispatch, parentPath, indexPosition],
  )

  const ButtonSize = 12

  return (
    <div
      style={{
        position: 'absolute',
        top: -ButtonSize / 2,
        left: -ButtonSize / 2,
        backgroundColor: 'white',
        width: ButtonSize,
        height: ButtonSize,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${1 / props.scale})`,
      }}
      data-testid={`insertion-plus-button-${props.identifier}`}
      onMouseDown={insertElement}
    >
      <div
        style={{
          width: ButtonSize - 2,
          height: ButtonSize - 2,
          backgroundColor: colorTheme.canvasSelectionPrimaryOutline.value,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 10,
            marginBottom: 2,
          }}
        >
          +
        </div>
      </div>
    </div>
  )
})

const Line = React.memo((props: ButtonControlProps) => {
  const colorTheme = useColorTheme()

  const LineWidth = 1 / props.scale

  return (
    <div
      style={{
        position: 'absolute',
        top: props.isHorizontalLine ? -LineWidth / 2 : 0,
        left: props.isHorizontalLine ? 0 : -LineWidth / 2,
        width: props.isHorizontalLine ? props.lineEndX - props.positionX : LineWidth,
        height: props.isHorizontalLine ? LineWidth : props.lineEndY - props.positionY,
        backgroundColor: colorTheme.canvasSelectionPrimaryOutline.value,
      }}
      data-testid={`insertion-plus-line-${props.identifier}`}
    />
  )
})
