import { ElementPath } from '../../core/shared/project-file-types'
import * as EP from '../../core/shared/element-path'
import { isFeatureEnabled } from '../../utils/feature-switches'
import {
  ElementInstanceMetadataMap,
  isJSXConditionalExpression,
  isJSXFragment,
  JSXConditionalExpression,
} from '../../core/shared/element-template'
import { MetadataUtils } from '../../core/model/element-metadata-utils'
import { foldEither, isRight } from '../../core/shared/either'
import {
  conditionalClauseNavigatorEntry,
  isConditionalClauseNavigatorEntry,
  NavigatorEntry,
  navigatorEntryToKey,
  regularNavigatorEntry,
  syntheticNavigatorEntry,
} from '../editor/store/editor-state'
import {
  buildTree,
  ElementPathTree,
  ElementPathTreeRoot,
  getSubTree,
  reorderTree,
} from '../../core/shared/element-path-tree'
import { objectValues } from '../../core/shared/object-utils'
import { fastForEach } from '../../core/shared/utils'
import { getConditionalClausePath, ThenOrElse } from '../../core/model/conditionals'

function baseNavigatorDepth(path: ElementPath): number {
  // The storyboard means that this starts at -1,
  // so that the scenes are the left most entity.
  return EP.fullDepth(path) - 1
}

export function navigatorDepth(
  navigatorEntry: NavigatorEntry,
  metadata: ElementInstanceMetadataMap,
): number {
  const path = navigatorEntry.elementPath
  let result: number = baseNavigatorDepth(path)
  for (const ancestorPath of EP.getAncestors(path)) {
    const elementMetadata = MetadataUtils.findElementByElementPath(metadata, ancestorPath)
    if (elementMetadata != null) {
      // If fragments are not supported, shift the depth back by 1 as they will not be included in the
      // hierarchy.
      if (!isFeatureEnabled('Fragment support')) {
        const isFragment = foldEither(
          () => false,
          (e) => isJSXFragment(e),
          elementMetadata.element,
        )
        if (isFragment) {
          result = result - 1
        }
      }

      // A conditional ancestor will shift this by an additional 1, for the clause.
      if (isFeatureEnabled('Conditional support')) {
        const isConditional = foldEither(
          () => false,
          (e) => isJSXConditionalExpression(e),
          elementMetadata.element,
        )
        if (isConditional) {
          result = result + 1
        }
      }
    }
  }

  // For the clause entry itself, this needs to step back by 1.
  if (
    isFeatureEnabled('Conditional support') &&
    isConditionalClauseNavigatorEntry(navigatorEntry)
  ) {
    result = result - 1
  }

  return result
}

interface GetNavigatorTargetsResults {
  navigatorTargets: Array<NavigatorEntry>
  visibleNavigatorTargets: Array<NavigatorEntry>
}

export function getNavigatorTargets(
  metadata: ElementInstanceMetadataMap,
  collapsedViews: Array<ElementPath>,
  hiddenInNavigator: Array<ElementPath>,
): GetNavigatorTargetsResults {
  // Note: This will not necessarily be representative of the structured ordering in
  // the code that produced these elements.
  const projectTree = buildTree(objectValues(metadata).map((m) => m.elementPath)).map((subTree) => {
    return reorderTree(subTree, metadata)
  })

  // This function exists separately from getAllPaths because the Navigator handles collapsed views
  let navigatorTargets: Array<NavigatorEntry> = []
  let visibleNavigatorTargets: Array<NavigatorEntry> = []

  function walkAndAddKeys(subTree: ElementPathTree | null, collapsedAncestor: boolean): void {
    if (subTree != null) {
      const path = subTree.path
      const isHiddenInNavigator = EP.containsPath(path, hiddenInNavigator)
      const isFragment = MetadataUtils.isElementPathFragmentFromMetadata(metadata, path)
      const isConditional = MetadataUtils.isElementPathConditionalFromMetadata(metadata, path)
      navigatorTargets.push(regularNavigatorEntry(path))
      if (
        !collapsedAncestor &&
        !isHiddenInNavigator &&
        (isFeatureEnabled('Fragment support') || !isFragment) &&
        (isFeatureEnabled('Conditional support') || !isConditional) &&
        !MetadataUtils.isElementTypeHiddenInNavigator(path, metadata)
      ) {
        visibleNavigatorTargets.push(regularNavigatorEntry(path))
      }

      const isCollapsed = EP.containsPath(path, collapsedViews)
      const newCollapsedAncestor = collapsedAncestor || isCollapsed || isHiddenInNavigator

      function walkSubTree(subTreeChildren: ElementPathTreeRoot): void {
        let unfurledComponents: Array<ElementPathTree> = []

        fastForEach(subTreeChildren, (child) => {
          if (EP.isRootElementOfInstance(child.path)) {
            unfurledComponents.push(child)
          } else {
            walkAndAddKeys(child, newCollapsedAncestor)
          }
        })

        fastForEach(unfurledComponents, (unfurledComponent) => {
          walkAndAddKeys(unfurledComponent, newCollapsedAncestor)
        })
      }

      function walkConditionalClause(
        conditionalSubTree: ElementPathTree,
        conditional: JSXConditionalExpression,
        thenOrElse: ThenOrElse,
      ): void {
        const clauseValue = thenOrElse === 'then' ? conditional.whenTrue : conditional.whenFalse

        // Get the clause path.
        const clausePath = getConditionalClausePath(path, clauseValue, thenOrElse)

        // Create the entry for the name of the clause.
        const clauseTitleEntry = conditionalClauseNavigatorEntry(clausePath, thenOrElse)
        navigatorTargets.push(clauseTitleEntry)
        visibleNavigatorTargets.push(clauseTitleEntry)

        // Create the entry for the value of the clause.
        const elementMetadata = MetadataUtils.findElementByElementPath(metadata, clausePath)
        if (elementMetadata == null) {
          const clauseValueEntry = syntheticNavigatorEntry(clausePath, clauseValue)
          navigatorTargets.push(clauseValueEntry)
          visibleNavigatorTargets.push(clauseValueEntry)
        }

        // Walk the clause of the conditional.
        const clausePathTree = conditionalSubTree.children.find((childPath) => {
          return EP.pathsEqual(childPath.path, clausePath)
        })
        if (clausePathTree != null) {
          walkAndAddKeys(clausePathTree, collapsedAncestor)
        }
      }

      if (isFeatureEnabled('Conditional support') && isConditional) {
        // Add in the additional elements for a conditional.
        const elementMetadata = MetadataUtils.findElementByElementPath(metadata, path)
        if (
          elementMetadata != null &&
          isRight(elementMetadata.element) &&
          isJSXConditionalExpression(elementMetadata.element.value)
        ) {
          const jsxConditionalElement: JSXConditionalExpression = elementMetadata.element.value

          walkConditionalClause(subTree, jsxConditionalElement, 'then')
          walkConditionalClause(subTree, jsxConditionalElement, 'else')
        } else {
          throw new Error(`Unexpected non-conditional expression retrieved at ${EP.toString(path)}`)
        }
      } else {
        walkSubTree(subTree.children)
      }
    }
  }

  const canvasRoots = MetadataUtils.getAllStoryboardChildrenPathsUnordered(metadata)
  fastForEach(canvasRoots, (childElement) => {
    const subTree = getSubTree(projectTree, childElement)

    walkAndAddKeys(subTree, false)
  })

  return {
    navigatorTargets: navigatorTargets,
    visibleNavigatorTargets: visibleNavigatorTargets,
  }
}
