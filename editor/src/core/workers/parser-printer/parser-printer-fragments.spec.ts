import { printCode, printCodeOptions } from './parser-printer'
import { applyPrettier } from './prettier-utils'
import {
  testParseCode,
  clearParseResultUniqueIDs,
  elementsStructure,
} from './parser-printer.test-utils'
import { AwkwardFragmentsCode } from './parser-printer-fragments.test-utils'
import { isParseSuccess } from '../../shared/project-file-types'

describe('JSX parser', () => {
  it('handle some weird nested fragments', () => {
    const code = applyPrettier(AwkwardFragmentsCode, false).formatted
    const parseResult = clearParseResultUniqueIDs(testParseCode(code))
    if (isParseSuccess(parseResult)) {
      expect(elementsStructure(parseResult.topLevelElements)).toMatchInlineSnapshot(`
        "UTOPIA_JSX_COMPONENT - App
          JSX_ELEMENT - View - aaa
            JSX_TEXT_BLOCK
            JSX_FRAGMENT
              JSX_ELEMENT - div - bbb
                JSX_TEXT_BLOCK
                JSX_FRAGMENT
                  JSX_ELEMENT - div - ccc
                JSX_TEXT_BLOCK
            JSX_TEXT_BLOCK
            JSX_ELEMENT - div - ddd
              JSX_TEXT_BLOCK
        UTOPIA_JSX_COMPONENT - storyboard
          JSX_ELEMENT - Storyboard - eee
            JSX_ELEMENT - Scene - fff"
      `)

      const printedCode = printCode(
        printCodeOptions(false, true, true),
        parseResult.imports,
        parseResult.topLevelElements,
        parseResult.jsxFactoryFunction,
        parseResult.exportsDetail,
      )

      expect(printedCode).toMatchInlineSnapshot(`
        "/** @jsx jsx */
        import * as React from 'react'
        import { Scene, Storyboard, View, jsx } from 'utopia-api'
        export var App = (props) => {
          return (
            <View
              style={{ ...props.style, backgroundColor: '#FFFFFF' }}
              layout={{ layoutSystem: 'pinSystem' }}
              data-uid='aaa'
            >
              <React.Fragment>
                <div data-label='random-div' style={{ width: 100, height: 100 }} data-uid='bbb'>
                  Hello
                  <>
                    <div data-label='some-other-div' style={{ width: 100, height: 100 }} data-uid='ccc' />
                  </>
                </div>
              </React.Fragment>
              <div data-uid='ddd'>World</div>
            </View>
          )
        }
        export var storyboard = (
          <Storyboard data-uid='eee'>
            <Scene
              style={{ position: 'absolute', height: 812, left: 0, width: 375, top: 0 }}
              component={App}
              props={{ style: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0 } }}
              data-uid='fff'
            />
          </Storyboard>
        )
        "
      `)
    } else {
      fail(parseResult)
    }
  })
})
