/**
 * You can customize the initial state of the module from the editor initialization, by passing the following [Configuration Object](https://github.com/artf/grapesjs/blob/master/src/commands/config/config.js)
 * ```js
 * const editor = grapesjs.init({
 *  commands: {
 *    // options
 *  }
 * })
 * ```
 *
 * Once the editor is instantiated you can use its API. Before using these methods you should get the module from the instance
 *
 * ```js
 * const commands = editor.Commands;
 * ```
 *
 * * [add](#add)
 * * [get](#get)
 * * [has](#has)
 * * [run](#run)
 * * [stop](#stop)
 *
 * @module Commands
 */

import { isFunction } from 'underscore';

module.exports = () => {
  let em;
  var c = {},
    commands = {},
    defaultCommands = {},
    defaults = require('./config/config'),
    CommandAbstract = require('./view/CommandAbstract');

  // Need it here as it would be used below
  var add = function(id, obj) {
    if (isFunction(obj)) {
      obj = { run: obj };
    }

    delete obj.initialize;
    obj.id = id;
    commands[id] = CommandAbstract.extend(obj);
    return this;
  };

  return {
    CommandAbstract,

    /**
     * Name of the module
     * @type {String}
     * @private
     */
    name: 'Commands',

    /**
     * Initialize module. Automatically called with a new instance of the editor
     * @param {Object} config Configurations
     * @private
     */
    init(config) {
      c = config || {};
      for (var name in defaults) {
        if (!(name in c)) c[name] = defaults[name];
      }
      em = c.em;
      var ppfx = c.pStylePrefix;
      if (ppfx) c.stylePrefix = ppfx + c.stylePrefix;

      // Load commands passed via configuration
      for (var k in c.defaults) {
        var obj = c.defaults[k];
        if (obj.id) this.add(obj.id, obj);
      }

      const ViewCode = require('./view/ExportTemplate');
      defaultCommands['select-comp'] = require('./view/SelectComponent');
      defaultCommands['create-comp'] = require('./view/CreateComponent');
      defaultCommands['delete-comp'] = require('./view/DeleteComponent');
      defaultCommands['image-comp'] = require('./view/ImageComponent');
      defaultCommands['move-comp'] = require('./view/MoveComponent');
      defaultCommands['text-comp'] = require('./view/TextComponent');
      defaultCommands['insert-custom'] = require('./view/InsertCustom');
      defaultCommands['export-template'] = ViewCode;
      defaultCommands['sw-visibility'] = require('./view/SwitchVisibility');
      defaultCommands['open-layers'] = require('./view/OpenLayers');
      defaultCommands['open-sm'] = require('./view/OpenStyleManager');
      defaultCommands['open-tm'] = require('./view/OpenTraitManager');
      defaultCommands['open-blocks'] = require('./view/OpenBlocks');
      defaultCommands['open-assets'] = require('./view/OpenAssets');
      defaultCommands['show-offset'] = require('./view/ShowOffset');
      defaultCommands['select-parent'] = require('./view/SelectParent');
      defaultCommands.fullscreen = require('./view/Fullscreen');
      defaultCommands.preview = require('./view/Preview');
      defaultCommands.resize = require('./view/Resize');
      defaultCommands.drag = require('./view/Drag');

      defaultCommands['tlb-delete'] = {
        run(ed) {
          return ed.runCommand('core:component-delete');
        }
      };

      defaultCommands['tlb-clone'] = {
        run(ed) {
          ed.runCommand('core:copy');
          ed.runCommand('core:paste');
        }
      };

      defaultCommands['tlb-move'] = {
        run(ed, sender, opts) {
          let dragger;
          const em = ed.getModel();
          const event = opts && opts.event;
          const sel = ed.getSelected();
          const selAll = [...ed.getSelectedAll()];
          const toolbarStyle = ed.Canvas.getToolbarEl().style;
          const nativeDrag = event && event.type == 'dragstart';
          const defComOptions = { preserveSelected: 1 };

          const hideTlb = () => {
            toolbarStyle.display = 'none';
            em.stopDefault(defComOptions);
          };

          if (!sel || !sel.get('draggable')) {
            console.warn('The element is not draggable');
            return;
          }

          // Without setTimeout the ghost image disappears
          nativeDrag ? setTimeout(() => hideTlb, 0) : hideTlb();

          const onStart = (e, opts) => {
            console.log('start mouse pos ', opts.start);
            console.log('el rect ', opts.elRect);
            var el = opts.el;
            el.style.position = 'absolute';
            el.style.margin = 0;
          };

          const onEnd = (e, opts) => {
            em.runDefault(defComOptions);
            selAll.forEach(sel => sel.set('status', 'selected'));
            ed.select(selAll);
            sel.emitUpdate();
            dragger && dragger.blur();
          };

          const onDrag = (e, opts) => {
            console.log('Delta ', opts.delta);
            console.log('Current ', opts.current);
          };

          if (em.get('designerMode')) {
            // TODO move grabbing func in editor/canvas from the Sorter
            dragger = editor.runCommand('drag', {
              el: sel.view.el,
              options: {
                event,
                onStart,
                onDrag,
                onEnd
              }
            });
          } else {
            if (nativeDrag) {
              event.dataTransfer.setDragImage(sel.view.el, 0, 0);
              //sel.set('status', 'freezed');
            }

            const cmdMove = ed.Commands.get('move-comp');
            cmdMove.onEndMoveFromModel = onEnd;
            cmdMove.initSorterFromModels(selAll);
          }

          selAll.forEach(sel => sel.set('status', 'freezed-selected'));
        }
      };

      // Core commands
      defaultCommands['core:undo'] = e => e.UndoManager.undo();
      defaultCommands['core:redo'] = e => e.UndoManager.redo();
      [
        ['copy', 'CopyComponent'],
        ['paste', 'PasteComponent'],
        ['component-next', 'ComponentNext'],
        ['component-prev', 'ComponentPrev'],
        ['component-enter', 'ComponentEnter'],
        ['component-exit', 'ComponentExit'],
        ['canvas-clear', 'CanvasClear'],
        ['component-delete', 'ComponentDelete']
      ].forEach(
        item =>
          (defaultCommands[`core:${item[0]}`] = require(`./view/${
            item[1]
          }`).run)
      );

      if (c.em) c.model = c.em.get('Canvas');

      this.loadDefaultCommands();

      return this;
    },

    /**
     * Add new command to the collection
     * @param	{string} id Command's ID
     * @param	{Object|Function} command Object representing your command,
     *  By passing just a function it's intended as a stateless command
     *  (just like passing an object with only `run` method).
     * @return {this}
     * @example
     * commands.add('myCommand', {
     * 	run(editor, sender) {
     * 		alert('Hello world!');
     * 	},
     * 	stop(editor, sender) {
     * 	},
     * });
     * // As a function
     * commands.add('myCommand2', editor => { ... });
     * */
    add,

    /**
     * Get command by ID
     * @param	{string}	id Command's ID
     * @return {Object} Object representing the command
     * @example
     * var myCommand = commands.get('myCommand');
     * myCommand.run();
     * */
    get(id) {
      var el = commands[id];

      if (typeof el == 'function') {
        el = new el(c);
        commands[id] = el;
      }

      return el;
    },

    /**
     * Check if command exists
     * @param	{string}	id Command's ID
     * @return {Boolean}
     * */
    has(id) {
      return !!commands[id];
    },

    /**
     * Execute the command
     * @param {String} id Command ID
     * @param {Object} [options={}] Options
     * @return {*} The return is defined by the command
     * @example
     * commands.run('myCommand', { someOption: 1 });
     */
    run(id, options = {}) {
      let result;
      const command = this.get(id);
      const editor = em.get('Editor');
      if (command) result = command.callRun(editor, options);

      return result;
    },

    /**
     * Stop the command
     * @param {String} id Command ID
     * @param {Object} [options={}] Options
     * @return {*} The return is defined by the command
     * @example
     * commands.stop('myCommand', { someOption: 1 });
     */
    stop(id, options = {}) {
      let result;
      const command = this.get(id);
      const editor = em.get('Editor');
      if (command) result = command.callStop(editor, options);

      return result;
    },

    /**
     * Load default commands
     * @return {this}
     * @private
     * */
    loadDefaultCommands() {
      for (var id in defaultCommands) {
        this.add(id, defaultCommands[id]);
      }

      return this;
    },

    /**
     * Create anonymous Command instance
     * @param {Object} command Command object
     * @return {Command}
     * @private
     * */
    create(command) {
      const cmd = CommandAbstract.extend(command);
      return new cmd(c);
    }
  };
};
