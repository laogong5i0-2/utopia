import * as ObjectPath from 'object-path'
import * as React from 'react'
import { FlexLayoutHelpers } from '../../core/layout/layout-helpers'
import { createLayoutPropertyPath } from '../../core/layout/layout-helpers-new'
import {
  findElementAtPath,
  getSimpleAttributeAtPath,
  MetadataUtils,
} from '../../core/model/element-metadata-utils'
import { findJSXElementAtStaticPath } from '../../core/model/element-template-utils'
import { isHTMLComponent } from '../../core/model/project-file-utils'
import { createSceneTemplatePath } from '../../core/model/scene-utils'
import { forEachRight, isRight, right } from '../../core/shared/either'
import {
  isJSXAttributeOtherJavaScript,
  isJSXElement,
  JSXAttribute,
  JSXAttributes,
  jsxAttributeValue,
  JSXElement,
  JSXElementName,
  SpecialSizeMeasurements,
  emptySpecialSizeMeasurements,
  ComputedStyle,
  getJSXAttribute,
  StyleAttributeMetadata,
} from '../../core/shared/element-template'
import { getJSXAttributeAtPath } from '../../core/shared/jsx-attributes'
import { canvasRectangle, localRectangle } from '../../core/shared/math-utils'
import {
  Imports,
  InstancePath,
  LayoutWrapper,
  PropertyPath,
  ScenePath,
  TemplatePath,
} from '../../core/shared/project-file-types'
import * as PP from '../../core/shared/property-path'
import * as TP from '../../core/shared/template-path'
import Utils from '../../utils/utils'
import { isAspectRatioLockedNew } from '../aspect-ratio'
import { setFocus } from '../common/actions'
import { Alignment, Distribution, EditorAction } from '../editor/action-types'
import * as EditorActions from '../editor/actions/action-creators'
import {
  alignSelectedViews,
  distributeSelectedViews,
  selectComponents,
  setAspectRatioLock,
  setProp_UNSAFE,
  setSceneProp,
  transientActions,
  unsetProperty,
  unsetSceneProp,
  unwrapLayoutable,
  wrapInLayoutable,
} from '../editor/actions/action-creators'
import { MiniMenu, MiniMenuItem } from '../editor/minimenu'
import {
  getOpenImportsFromState,
  getOpenUtopiaJSXComponentsFromState,
  getOpenUtopiaJSXComponentsFromStateMultifile,
  isOpenFileUiJs,
} from '../editor/store/editor-state'
import { useEditorState } from '../editor/store/store-hook'
import { CSSPosition } from './common/css-utils'
import { InspectorCallbackContext, InspectorPropsContext } from './common/property-path-hooks'
import { ComponentSection } from './sections/component-section/component-section'
import { EventHandlersSection } from './sections/event-handlers-section/event-handlers-section'
import {
  CSSTarget,
  cssTarget,
  TargetSelectorLength,
} from './sections/header-section/target-selector'
import { ImgSection } from './sections/image-section/image-section'
import { LayoutSection, ResolvedLayoutProps } from './sections/layout-section/layout-section'
import { WarningSubsection } from './sections/layout-section/warning-subsection/warning-subsection'
import { SceneSection } from './sections/scene-inspector/scene-section'
import { SettingsPanel } from './sections/settings-panel/inspector-settingspanel'
import { ClassNameSubsection } from './sections/style-section/className-subsection/className-subsection'
import { StyleSection } from './sections/style-section/style-section'
import {
  TargetSelectorSection,
  TargetSelectorSectionProps,
} from './sections/target-selector-section'
import { usePropControlledRef_DANGEROUS } from './common/inspector-utils'
import { arrayEquals } from '../../core/shared/utils'
import {
  betterReactMemo,
  useKeepReferenceEqualityIfPossible,
  useKeepShallowReferenceEquality,
} from '../../utils/react-performance'
import { Icn, colorTheme, InspectorSectionHeader, UtopiaTheme, FlexRow } from '../../uuiui'
import { emptyComments } from '../../core/workers/parser-printer/parser-printer-comments'
import { getElementsToTarget } from './common/inspector-utils'

export interface InspectorModel {
  layout?: ResolvedLayoutProps
  isChildOfFlexComponent: boolean
  position: CSSPosition | null
  layoutWrapper: null | LayoutWrapper
  label: string
  type: null | string
  parentFlexAxis: 'horizontal' | 'vertical' | null
  specialSizeMeasurements: SpecialSizeMeasurements
}

export interface ElementPathElement {
  name?: string
  path: TemplatePath
}

export interface InspectorPartProps<T> {
  input: T
  onSubmitValue: (output: T, paths: Array<PropertyPath>) => void
}
export interface InspectorProps
  extends InspectorPartProps<InspectorModel>,
    TargetSelectorSectionProps {
  selectedViews: Array<TemplatePath>
  elementPath: Array<ElementPathElement>
}

interface AlignDistributeButtonProps {
  onMouseUp: () => void
  toolTip: string
  iconType: string
  disabled: boolean
}

const AlignDistributeButton = betterReactMemo<AlignDistributeButtonProps>(
  'AlignDistributeButton',
  (props: AlignDistributeButtonProps) => {
    return (
      <MiniMenuItem
        className='mr2'
        animationClassName='darken'
        disabled={props.disabled}
        onMouseUp={props.onMouseUp}
      >
        <Icn
          tooltipText={props.toolTip}
          category='layout/commands'
          type={props.iconType}
          color='darkgray'
          width={16}
          height={16}
        />
      </MiniMenuItem>
    )
  },
)
AlignDistributeButton.displayName = 'AlignDistributeButton'

const AlignmentButtons = betterReactMemo(
  'AlignmentButtons',
  (props: { numberOfTargets: number }) => {
    const dispatch = useEditorState((store) => store.dispatch, 'AlignmentButtons dispatch')
    const alignSelected = React.useCallback(
      (alignment: Alignment) => {
        dispatch([alignSelectedViews(alignment)], 'everyone')
      },
      [dispatch],
    )

    const distributeSelected = React.useCallback(
      (distribution: Distribution) => {
        dispatch([distributeSelectedViews(distribution)], 'everyone')
      },
      [dispatch],
    )
    const disableAlign = props.numberOfTargets === 0
    const disableDistribute = props.numberOfTargets < 3
    const multipleTargets = props.numberOfTargets > 1

    const alignLeft = React.useCallback(() => alignSelected('left'), [alignSelected])
    const alignHCenter = React.useCallback(() => alignSelected('hcenter'), [alignSelected])
    const alignRight = React.useCallback(() => alignSelected('right'), [alignSelected])
    const alignTop = React.useCallback(() => alignSelected('top'), [alignSelected])
    const alignVCenter = React.useCallback(() => alignSelected('vcenter'), [alignSelected])
    const alignBottom = React.useCallback(() => alignSelected('bottom'), [alignSelected])
    const distributeHorizontal = React.useCallback(() => distributeSelected('horizontal'), [
      distributeSelected,
    ])
    const distributeVertical = React.useCallback(() => distributeSelected('vertical'), [
      distributeSelected,
    ])

    return (
      <MiniMenu className='justify-around'>
        <AlignDistributeButton
          onMouseUp={alignLeft}
          toolTip={`Align to left of ${multipleTargets ? 'selection' : 'parent'}`}
          iconType='alignLeft'
          disabled={disableAlign}
        />
        <AlignDistributeButton
          onMouseUp={alignHCenter}
          toolTip={`Align to horizontal center of ${multipleTargets ? 'selection' : 'parent'}`}
          iconType='alignHorizontalCenter'
          disabled={disableAlign}
        />
        <AlignDistributeButton
          onMouseUp={alignRight}
          toolTip={`Align to right of ${multipleTargets ? 'selection' : 'parent'}`}
          iconType='alignRight'
          disabled={disableAlign}
        />
        <AlignDistributeButton
          onMouseUp={alignTop}
          toolTip={`Align to top of ${multipleTargets ? 'selection' : 'parent'}`}
          iconType='alignTop'
          disabled={disableAlign}
        />
        <AlignDistributeButton
          onMouseUp={alignVCenter}
          toolTip={`Align to vertical center of ${multipleTargets ? 'selection' : 'parent'}`}
          iconType='alignVerticalCenter'
          disabled={disableAlign}
        />
        <AlignDistributeButton
          onMouseUp={alignBottom}
          toolTip={`Align to bottom of ${multipleTargets ? 'selection' : 'parent'}`}
          iconType='alignBottom'
          disabled={disableAlign}
        />
        <AlignDistributeButton
          onMouseUp={distributeHorizontal}
          toolTip={`Distribute horizontally ↔`}
          iconType='distributeHorizontal'
          disabled={disableDistribute}
        />
        <AlignDistributeButton
          onMouseUp={distributeVertical}
          toolTip={`Distribute vertically ↕️`}
          iconType='distributeVertical'
          disabled={disableDistribute}
        />
      </MiniMenu>
    )
  },
)
AlignmentButtons.displayName = 'AlignmentButtons'

interface RenderedLayoutSectionProps {
  layout: any
  anyHTMLElements: boolean
  specialSizeMeasurements: SpecialSizeMeasurements
  isChildOfFlexComponent: boolean
  hasNonDefaultPositionAttributes: boolean
  parentFlexAxis: 'horizontal' | 'vertical' | null
  aspectRatioLocked: boolean
  toggleAspectRatioLock: () => void
  position: CSSPosition | null
}

const RenderedLayoutSection = betterReactMemo<RenderedLayoutSectionProps>(
  'RenderedLayoutSection',
  (props: RenderedLayoutSectionProps) => {
    if (props.layout == null) {
      return null
    } else {
      return (
        <LayoutSection
          input={props.layout}
          parentFlexAxis={props.parentFlexAxis}
          specialSizeMeasurements={props.specialSizeMeasurements}
          isChildOfFlexComponent={props.isChildOfFlexComponent}
          hasNonDefaultPositionAttributes={props.hasNonDefaultPositionAttributes}
          aspectRatioLocked={props.aspectRatioLocked}
          toggleAspectRatioLock={props.toggleAspectRatioLock}
          position={props.position}
        />
      )
    }
  },
)
RenderedLayoutSection.displayName = 'RenderedLayoutSection'

const nonDefaultPositionPaths: Array<PropertyPath> = [
  createLayoutPropertyPath('PinnedRight'),
  createLayoutPropertyPath('PinnedBottom'),
]

export const Inspector = betterReactMemo<InspectorProps>('Inspector', (props: InspectorProps) => {
  const { selectedViews } = props
  const {
    dispatch,
    focusedPanel,
    anyComponents,
    anyHTMLElements,
    anyUnknownElements,
    hasNonDefaultPositionAttributes,
    aspectRatioLocked,
  } = useEditorState((store) => {
    const rootMetadata = store.editor.jsxMetadata
    const imports = getOpenImportsFromState(store.editor)
    const rootComponents = getOpenUtopiaJSXComponentsFromStateMultifile(store.editor)
    let anyComponentsInner: boolean = false
    let anyHTMLElementsInner: boolean = false
    let anyUnknownElementsInner: boolean = false
    let hasNonDefaultPositionAttributesInner: boolean = false
    let aspectRatioLockedInner: boolean = false
    Utils.fastForEach(selectedViews, (view) => {
      if (TP.isScenePath(view)) {
        // TODO Scene Implementation
        return
      }
      anyComponentsInner =
        anyComponentsInner ||
        MetadataUtils.isComponentInstance(view, rootComponents, rootMetadata, imports)
      const possibleElement = MetadataUtils.getElementByInstancePathMaybe(rootMetadata, view)
      if (possibleElement != null) {
        // Slightly coarse in definition, but element metadata is in a weird little world of
        // its own compared to the props.
        aspectRatioLockedInner = aspectRatioLockedInner || isAspectRatioLockedNew(possibleElement)

        const elementOriginType = MetadataUtils.getElementOriginType(rootComponents, view)
        if (elementOriginType === 'unknown-element') {
          anyUnknownElementsInner = true
        }
        if (isRight(possibleElement.element)) {
          const elem = possibleElement.element.value
          if (isJSXElement(elem)) {
            if (!hasNonDefaultPositionAttributesInner) {
              for (const nonDefaultPositionPath of nonDefaultPositionPaths) {
                const attributeAtPath = getJSXAttributeAtPath(elem.props, nonDefaultPositionPath)
                if (attributeAtPath.attribute.type !== 'ATTRIBUTE_NOT_FOUND') {
                  hasNonDefaultPositionAttributesInner = true
                }
              }
            }
            if (isHTMLComponent(elem.name, imports)) {
              anyHTMLElementsInner = true
            }
          }
        }
      }
    })
    return {
      dispatch: store.dispatch,
      focusedPanel: store.editor.focusedPanel,
      anyComponents: anyComponentsInner,
      anyHTMLElements: anyHTMLElementsInner,
      anyUnknownElements: anyUnknownElementsInner,
      hasNonDefaultPositionAttributes: hasNonDefaultPositionAttributesInner,
      aspectRatioLocked: aspectRatioLockedInner,
    }
  }, 'Inspector')
  const instancePaths = useKeepReferenceEqualityIfPossible(
    selectedViews.filter((view) => !TP.isScenePath(view)) as InstancePath[],
  )

  const onFocus = React.useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (focusedPanel !== 'inspector') {
        dispatch([setFocus('inspector')], 'inspector')
      }
    },
    [dispatch, focusedPanel],
  )

  const toggleAspectRatioLock = React.useCallback(() => {
    const actions = instancePaths.map((path) => {
      return setAspectRatioLock(path, !aspectRatioLocked)
    })
    dispatch(actions, 'everyone')
  }, [dispatch, instancePaths, aspectRatioLocked])

  function renderInspectorContents() {
    if (props.elementPath.length == 0 || anyUnknownElements) {
      return <SettingsPanel />
    } else if (props.elementPath.length === 1 && TP.isScenePath(props.elementPath[0].path)) {
      return <SceneSection scenePath={props.elementPath[0].path} />
    } else {
      return (
        <React.Fragment>
          <AlignmentButtons numberOfTargets={instancePaths.length} />
          <RenderedLayoutSection
            anyHTMLElements={anyHTMLElements}
            layout={props.input.layout}
            specialSizeMeasurements={props.input.specialSizeMeasurements}
            isChildOfFlexComponent={props.input.isChildOfFlexComponent}
            hasNonDefaultPositionAttributes={hasNonDefaultPositionAttributes}
            parentFlexAxis={props.input.parentFlexAxis}
            aspectRatioLocked={aspectRatioLocked}
            toggleAspectRatioLock={toggleAspectRatioLock}
            position={props.input.position}
          />
          <ClassNameSubsection />
          <StyleSection />
          <WarningSubsection />
          {anyComponents ? <ComponentSection isScene={false} /> : null}
          <ImgSection />
          <TargetSelectorSection
            targets={props.targets}
            selectedTargetPath={props.selectedTargetPath}
            onSelectTarget={props.onSelectTarget}
            onStyleSelectorRename={props.onStyleSelectorRename}
            onStyleSelectorDelete={props.onStyleSelectorDelete}
            onStyleSelectorInsert={props.onStyleSelectorInsert}
          />
          <EventHandlersSection />
        </React.Fragment>
      )
    }
  }
  //first
  return (
    <div
      id='inspector'
      style={{
        width: '100%',
        position: 'relative',
        color: colorTheme.neutralForeground.value,
      }}
      onFocus={onFocus}
    >
      {renderInspectorContents()}
    </div>
  )
})
Inspector.displayName = 'Inspector'

const DefaultStyleTargets: Array<CSSTarget> = [cssTarget(['style'], 0), cssTarget(['css'], 0)]

export const InspectorEntryPoint: React.FunctionComponent = betterReactMemo(
  'InspectorEntryPoint',
  () => {
    const selectedViews = useEditorState(
      (store) => store.editor.selectedViews,
      'InspectorEntryPoint selectedViews',
    )
    const rootViewsForSelectedElement: Array<TemplatePath> = useEditorState(
      (store) => MetadataUtils.getRootViews(store.editor.jsxMetadata, selectedViews[0]),
      'InspectorEntryPoint',
      (oldTemplatePaths, newTemplatePaths) => {
        return arrayEquals(oldTemplatePaths, newTemplatePaths, TP.pathsEqual)
      },
    )

    const showSceneInspector = selectedViews.length === 1 && rootViewsForSelectedElement.length > 0

    if (showSceneInspector) {
      return (
        <>
          <SingleInspectorEntryPoint selectedViews={selectedViews} />
          <InspectorSectionHeader style={{ paddingTop: 32 }}>Root View</InspectorSectionHeader>
          <SingleInspectorEntryPoint selectedViews={rootViewsForSelectedElement} />
        </>
      )
    } else {
      return <SingleInspectorEntryPoint selectedViews={selectedViews} />
    }
  },
)

export const SingleInspectorEntryPoint: React.FunctionComponent<{
  selectedViews: Array<TemplatePath>
}> = betterReactMemo('SingleInspectorEntryPoint', (props) => {
  const { selectedViews } = props
  const { dispatch, jsxMetadata, rootComponents, isUIJSFile, imports } = useEditorState((store) => {
    return {
      dispatch: store.dispatch,
      jsxMetadata: store.editor.jsxMetadata,
      rootComponents: getOpenUtopiaJSXComponentsFromState(store.editor),
      isUIJSFile: isOpenFileUiJs(store.editor),
      imports: getOpenImportsFromState(store.editor),
    }
  }, 'SingleInspectorEntryPoint')

  let inspectorModel: InspectorModel = {
    isChildOfFlexComponent: false,
    position: 'static',
    layoutWrapper: null,
    label: '',
    type: null,
    parentFlexAxis: null,
    specialSizeMeasurements: emptySpecialSizeMeasurements,
  }

  let targets: Array<CSSTarget> = [...DefaultStyleTargets]

  Utils.fastForEach(TP.filterScenes(selectedViews), (path) => {
    // TODO multiselect
    const elementMetadata = MetadataUtils.getElementByInstancePathMaybe(jsxMetadata, path)
    if (elementMetadata != null) {
      const jsxElement = findElementAtPath(path, rootComponents)
      const parentPath = TP.parentPath(path)
      const parentElement =
        parentPath != null && TP.isInstancePath(parentPath)
          ? findElementAtPath(parentPath, rootComponents)
          : null

      const nonGroupAncestor = MetadataUtils.findNonGroupParent(jsxMetadata, path)
      const nonGroupAncestorFrame =
        nonGroupAncestor == null
          ? null
          : MetadataUtils.getFrameInCanvasCoords(nonGroupAncestor, jsxMetadata)

      const elementFrame = MetadataUtils.shiftGroupFrame(
        jsxMetadata,
        path,
        canvasRectangle(elementMetadata.localFrame),
        true,
      )
      inspectorModel.layout = {
        frame: localRectangle(elementFrame),
        parentFrame: nonGroupAncestorFrame,
      }
      if (jsxElement != null && isJSXElement(jsxElement)) {
        function updateTargets(localJSXElement: JSXElement): Array<CSSTarget> {
          let localTargets: Array<CSSTarget> = []
          function recursivelyDiscoverStyleTargets(
            styleObject: any,
            localPath: Array<string>,
          ): void {
            if (typeof styleObject === 'object' && styleObject != null) {
              let selectorLength: TargetSelectorLength = 0
              const keys = Object.keys(styleObject)
              keys.forEach((key) => {
                if (typeof styleObject[key] === 'object') {
                  recursivelyDiscoverStyleTargets((styleObject as any)[key], [...localPath, key])
                } else if (typeof selectorLength === 'number') {
                  selectorLength = selectorLength + 1
                }
              })
              localTargets.push(cssTarget(localPath, selectorLength))
            }
          }
          let defaults = [...DefaultStyleTargets]
          defaults.reverse().map((defaultTarget) => {
            const styleObject = getSimpleAttributeAtPath(
              right(localJSXElement.props),
              PP.create(defaultTarget.path),
            )
            if (isRight(styleObject) && styleObject.value instanceof Object) {
              recursivelyDiscoverStyleTargets(styleObject.value, defaultTarget.path)
            } else {
              // todo count keys
              localTargets.push(defaultTarget)
            }
          })
          localTargets.reverse()
          return localTargets
        }
        targets = updateTargets(jsxElement)
      }
      if (parentElement != null && isJSXElement(parentElement)) {
        const isChildOfFlexComponent = MetadataUtils.isParentYogaLayoutedContainerForElement(
          elementMetadata,
        )
        if (isChildOfFlexComponent) {
          inspectorModel.isChildOfFlexComponent = true
          const parentFlexDirection = FlexLayoutHelpers.getMainAxis(right(parentElement.props))
          forEachRight(parentFlexDirection, (mainAxis) => {
            inspectorModel.parentFlexAxis = mainAxis
          })
        }
      }
      if (jsxElement != null && isJSXElement(jsxElement)) {
        const elementName = jsxElement.name.baseVariable
        inspectorModel.type = elementName

        inspectorModel.specialSizeMeasurements = elementMetadata.specialSizeMeasurements
        inspectorModel.position = elementMetadata.specialSizeMeasurements.position

        if (jsxElement.props != null) {
          if (MetadataUtils.isLayoutWrapperAgainstImports(imports, elementMetadata)) {
            inspectorModel.layoutWrapper = elementName as any
          }
          const wrappedComponent = getJSXAttribute(jsxElement.props, 'wrappedComponent')
          if (wrappedComponent != null && isJSXAttributeOtherJavaScript(wrappedComponent)) {
            inspectorModel.type = wrappedComponent.javascript
          }
        }
      }
      inspectorModel.label = MetadataUtils.getElementLabel(path, jsxMetadata)
    }
  })

  // FIXME TODO HACK until we have better memoization in the Canvas Spy, we sacrifice using R.equals once
  // in order to prevent a big rerender of the inspector

  const inspectorModelReferentiallyStable = useKeepReferenceEqualityIfPossible(inspectorModel)
  const targetsReferentiallyStable = useKeepReferenceEqualityIfPossible(targets)

  const refElementsToTargetForUpdates = usePropControlledRef_DANGEROUS(
    getElementsToTarget(selectedViews),
  )

  const elementPath = useKeepReferenceEqualityIfPossible(
    React.useMemo(() => {
      if (selectedViews.length === 0) {
        return []
      }

      let elements: Array<ElementPathElement> = []
      Utils.fastForEach(TP.allPaths(selectedViews[0]), (path) => {
        // TODO Scene Implementation
        if (TP.isInstancePath(path)) {
          const component = MetadataUtils.getElementByInstancePathMaybe(jsxMetadata, path)
          if (component != null) {
            elements.push({
              name: MetadataUtils.getElementLabel(path, jsxMetadata),
              path: path,
            })
          }
        } else {
          const scene = MetadataUtils.findElementByTemplatePath(jsxMetadata, path)
          if (scene != null) {
            elements.push({
              name: scene.label ?? undefined,
              path: path,
            })
          }
        }
      })
      return elements
    }, [selectedViews, jsxMetadata]),
  )

  // Memoized Callbacks

  const onSubmitValue = React.useCallback(
    (newModel: InspectorModel, paths: PropertyPath[]) => {
      const updates = paths.map((path) => {
        return { path: path, value: ObjectPath.get(newModel, PP.getElements(path)) }
      })
      const actions = Utils.flatMapArray(
        (elem) =>
          updates.map((update) =>
            setProp_UNSAFE(elem, update.path, jsxAttributeValue(update.value, emptyComments)),
          ),
        refElementsToTargetForUpdates.current,
      )
      dispatch(actions, 'everyone')
    },
    [dispatch, refElementsToTargetForUpdates],
  )

  const [selectedTarget, setSelectedTarget] = React.useState<Array<string>>(
    targetsReferentiallyStable[0].path,
  )

  const onSelectTarget = React.useCallback((targetPath: Array<string>) => {
    setSelectedTarget(targetPath)
  }, [])

  const onStyleSelectorRename = React.useCallback(
    (renameTarget: CSSTarget, label: string) => {
      const originalRenameTarget: CSSTarget = { ...renameTarget }
      let newPath = [...renameTarget.path]
      newPath[newPath.length - 1] = label
      const actions: Array<EditorAction> = refElementsToTargetForUpdates.current.map((elem) =>
        EditorActions.renamePropKey(elem, originalRenameTarget, newPath),
      )
      let newTargetPath = [...originalRenameTarget.path]
      newTargetPath[newTargetPath.length - 1] = label
      if (Utils.shallowEqual(originalRenameTarget, selectedTarget)) {
        setSelectedTarget(newTargetPath)
      }
      dispatch(actions, 'everyone')
    },
    [refElementsToTargetForUpdates, dispatch, selectedTarget],
  )

  const onStyleSelectorDelete = React.useCallback(
    (deleteTarget: CSSTarget) => {
      const path = PP.create(deleteTarget.path)
      const actions = Utils.flatMapArray(
        (elem) => [EditorActions.unsetProperty(elem, path)],
        refElementsToTargetForUpdates.current,
      )
      dispatch(actions, 'everyone')
    },
    [refElementsToTargetForUpdates, dispatch],
  )

  const onStyleSelectorInsert = React.useCallback(
    (parent: CSSTarget, label: string) => {
      const newPath = [...parent.path, label]
      const newPropertyPath = PP.create(newPath)
      const actions: Array<EditorAction> = refElementsToTargetForUpdates.current.map((elem) =>
        EditorActions.setProp_UNSAFE(elem, newPropertyPath, jsxAttributeValue({}, emptyComments)),
      )
      dispatch(actions, 'everyone')
      setSelectedTarget(newPath)
    },
    [refElementsToTargetForUpdates, dispatch],
  )

  const onWrap = React.useCallback(
    (value: string) => {
      const actions = refElementsToTargetForUpdates.current.map((path) => {
        return wrapInLayoutable(path, value as any)
      })
      dispatch(actions, 'everyone')
    },
    [dispatch, refElementsToTargetForUpdates],
  )
  const onUnwrap = React.useCallback(() => {
    const actions = refElementsToTargetForUpdates.current.map((path) => {
      return unwrapLayoutable(path)
    })
    dispatch(actions, 'everyone')
  }, [dispatch, refElementsToTargetForUpdates])

  const inspector = isUIJSFile ? (
    <InspectorContextProvider selectedViews={selectedViews} targetPath={selectedTarget}>
      <Inspector
        selectedViews={selectedViews}
        input={inspectorModelReferentiallyStable}
        onSubmitValue={onSubmitValue}
        targets={targetsReferentiallyStable}
        selectedTargetPath={selectedTarget}
        elementPath={elementPath}
        onSelectTarget={onSelectTarget}
        onStyleSelectorRename={onStyleSelectorRename}
        onStyleSelectorDelete={onStyleSelectorDelete}
        onStyleSelectorInsert={onStyleSelectorInsert}
      />
    </InspectorContextProvider>
  ) : null

  return inspector
})

export const InspectorContextProvider = betterReactMemo<{
  selectedViews: Array<TemplatePath>
  targetPath: Array<string>
  children: React.ReactNode
}>('InspectorContextProvider', (props) => {
  const { selectedViews } = props
  const { dispatch, jsxMetadata } = useEditorState((store) => {
    return {
      dispatch: store.dispatch,
      jsxMetadata: store.editor.jsxMetadata,
    }
  }, 'InspectorContextProvider')

  const rootComponents = useKeepReferenceEqualityIfPossible(
    useEditorState(
      (store) => getOpenUtopiaJSXComponentsFromStateMultifile(store.editor),
      'InspectorContextProvider rootComponents',
    ),
  )

  let newEditedMultiSelectedProps: JSXAttributes[] = []
  let newSpiedProps: Array<{ [key: string]: any }> = []
  let newComputedStyles: Array<ComputedStyle> = []
  let newAttributeMetadatas: Array<StyleAttributeMetadata> = []

  Utils.fastForEach(selectedViews, (path) => {
    if (TP.isScenePath(path)) {
      const sceneTemplatePath = createSceneTemplatePath(path)
      const selectedSceneElement = findJSXElementAtStaticPath(rootComponents, sceneTemplatePath)
      if (selectedSceneElement != null) {
        newEditedMultiSelectedProps.push(selectedSceneElement.props)
      }
    } else {
      const elementMetadata = MetadataUtils.getElementByInstancePathMaybe(jsxMetadata, path)
      if (elementMetadata != null) {
        if (elementMetadata.computedStyle == null || elementMetadata.attributeMetadatada == null) {
          /**
           * This early return will cause the inspector to render with empty fields.
           * Because the computedStyle is only used in some cases for some controls,
           * the empty inspector helps us catch an otherwise silent regression
           */
          return
        }
        const jsxElement = findElementAtPath(path, rootComponents)
        if (jsxElement == null) {
          /**
           * This early return will cause the inspector to render with empty fields.
           * With missing jsxElement manipulating style props is not possible.
           */
          return
        }

        const jsxAttributes = isJSXElement(jsxElement) ? jsxElement.props : []
        newEditedMultiSelectedProps.push(jsxAttributes)
        newSpiedProps.push(elementMetadata.props)
        newComputedStyles.push(elementMetadata.computedStyle)
        newAttributeMetadatas.push(elementMetadata.attributeMetadatada)
      }
    }
  })

  const editedMultiSelectedProps = useKeepReferenceEqualityIfPossible(newEditedMultiSelectedProps)
  const spiedProps = useKeepReferenceEqualityIfPossible(newSpiedProps)
  const computedStyles = useKeepReferenceEqualityIfPossible(newComputedStyles)
  const attributeMetadatas = useKeepReferenceEqualityIfPossible(newAttributeMetadatas)

  const selectedViewsRef = usePropControlledRef_DANGEROUS(selectedViews)
  const refElementsToTargetForUpdates = usePropControlledRef_DANGEROUS(
    getElementsToTarget(selectedViews),
  )

  const refScenesToTargetForUpdates = usePropControlledRef_DANGEROUS(
    useKeepReferenceEqualityIfPossible(
      selectedViews.filter((view) => TP.isScenePath(view)) as ScenePath[],
    ),
  )

  const onSubmitValueForHooks = React.useCallback(
    (newValue: JSXAttribute, path: PropertyPath, transient: boolean) => {
      const actionsArray = [
        ...refElementsToTargetForUpdates.current.map((elem) => {
          return setProp_UNSAFE(elem, path, newValue)
        }),
        ...refScenesToTargetForUpdates.current.map((scene) => {
          return setSceneProp(scene, path, newValue)
        }),
      ]
      const actions: EditorAction[] = transient ? [transientActions(actionsArray)] : actionsArray
      dispatch(actions, 'everyone')
    },
    [dispatch, refElementsToTargetForUpdates, refScenesToTargetForUpdates],
  )

  const onUnsetValue = React.useCallback(
    (property: PropertyPath | Array<PropertyPath>) => {
      let actions: Array<EditorAction> = []
      Utils.fastForEach(refElementsToTargetForUpdates.current, (elem) => {
        if (Array.isArray(property)) {
          Utils.fastForEach(property, (p) => {
            actions.push(unsetProperty(elem, p))
          })
        } else {
          actions.push(unsetProperty(elem, property))
        }
      })
      Utils.fastForEach(refScenesToTargetForUpdates.current, (scene) => {
        if (Array.isArray(property)) {
          Utils.fastForEach(property, (p) => {
            actions.push(unsetSceneProp(scene, p))
          })
        } else {
          actions.push(unsetSceneProp(scene, property))
        }
      })
      dispatch(actions, 'everyone')
    },
    [dispatch, refElementsToTargetForUpdates, refScenesToTargetForUpdates],
  )

  const callbackContextValueMemoized = useKeepShallowReferenceEquality({
    onSubmitValue: onSubmitValueForHooks,
    onUnsetValue: onUnsetValue,
    selectedViewsRef: selectedViewsRef,
  })

  return (
    <InspectorCallbackContext.Provider value={callbackContextValueMemoized}>
      <InspectorPropsContext.Provider
        value={{
          selectedViews: selectedViews,
          editedMultiSelectedProps: editedMultiSelectedProps,
          targetPath: props.targetPath,
          spiedProps: spiedProps,
          computedStyles: computedStyles,
          selectedAttributeMetadatas: attributeMetadatas,
        }}
      >
        {props.children}
      </InspectorPropsContext.Provider>
    </InspectorCallbackContext.Provider>
  )
})
