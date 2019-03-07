import CompileOrder from '../order';
import Utils from '../../common/utils';
import LogHandler from '../../common/log';
import { LOGTAG, compileNodes } from '..';
import { setData, notifyDataChange } from '../../observer/index'

/** 组件参数默认配置 */
const COMPONENTPROPDEFAULTDATA = {
    type: undefined,
    default: undefined,
    required: false,
    validate: () => { return true }
}

/**已解析后的类型数据 */
let PropTypes = {};

/**
 *  作者：张传辉
 *  功能名称：组件核心处理
 *  描述信息：
*/
CompileOrder.addOrder({
    name: "component",
    //权重 
    weight: -1000,
    isSkipChildren: true,
    exec: function (target, nv, ov) { },
    breforeExec: function (token, option, scope, tokens) {
        token.exp = undefined;

        if (token.node.componentLoaded) return;

        //保证标签不会出现循环渲染。
        token.node.componentLoaded = true;
        token.componentId = token.$node.attr("id") || (token.component.name + '_' + Utils.guid());
        token.after = token.$node.after(document.createTextNode(""), true);
        token.$node.remove();

        token.componentView = this.initChildrenView(token.component.parser, token);

        //设置组件分组
        token.componentView.componentGroup = token.component.group
            || token.componentView.componentGroup;
        if (option.view) {

            this.insertTokenPropMapping(token, token.componentView, tokens);

            this.setDefaultViewData(token.componentView, token.node, token.propsData, tokens);

            this.renderChildren(token.componentView, token, option, scope);

            option.view.attachChild(token.after, token.componentId, token.componentView, undefined);
        }
        else {
            LogHandler.error(LOGTAG, '装载组件时，未找到视图组件');
        }
    },
    setDefaultViewData: function (view, node, propsData, tokens) {
        let attributes = node.attributes;

        view.attrDatas = attributes;

        for (let name in propsData) {
            let item = propsData[name];
            if (item.token) {
                this.responseViewData(view, name, item, item.value);
            }
            else {
                this.responseViewData(view, name, item, attributes[name] ? attributes[name].value : undefined);
            }
        }
    },
    initChildrenView: function (parser, token) {
        return new Buz.View({
            isComponent: true,
            noContainer: true,
            componentNode: token.$node,
            data: {}
        }, parser)();
    },
    insertTokenPropMapping: function (token, view, tokens) {
        let propsData = {};
        if (view.props) {
            if (Utils.isPlainObject(view.props)) {
                for (let name in view.props) {
                    let item = view.props[name];
                    if (Utils.isArray(item)) {
                        propsData[name] = Object.assign({}, COMPONENTPROPDEFAULTDATA, {
                            type: item
                        });
                    }
                    else if (typeof item === 'function') {
                        propsData[name] = Object.assign({}, COMPONENTPROPDEFAULTDATA, {
                            type: [item]
                        });
                    }
                    else if (Utils.isPlainObject(item)) {
                        propsData[name] = Object.assign({}, COMPONENTPROPDEFAULTDATA, item);
                    }
                }
            }
            else if (Utils.isArray(view.props)) {
                view.props.forEach((item) => {
                    propsData[item] = Object.assign({}, COMPONENTPROPDEFAULTDATA);
                });
            }
        }

        token.propsData = propsData;

        if (Utils.isObjEmpty(propsData)) return;

        let self = this;
        tokens.forEach((token) => {
            let propItem = propsData[token.param];

            if (token.order === 'attr' && propItem) {
                propItem.value = token.oldValue;
                propItem.token = token;
                token.hooks.push(function (option, nv, ov) {
                    self.responseViewData(view, token.param, propItem, nv);
                });
            }
        });
    },
    responseViewData: function (view, name, propItem, value) {

        if (Utils.isStrEmpty(value) && propItem.required) {
            LogHandler.error(LOGTAG, `组件未设置${name}参数，此项为必填项`);
            return;
        }

        if (value !== undefined && propItem.type && this._checkPropType(propItem.type, value) === false) {
            LogHandler.error(LOGTAG, `组件${name}参数，类型传入不正确`);
            return;
        }

        if (Utils.isFunction(propItem.validate) && propItem.validate(value) === false) {
            LogHandler.error(LOGTAG, `组件${name}参数，自定义校验未通过`);
            return;
        }

        let result = (value === undefined) ? propItem.default : value;
        propItem.value = value;

        setData(view.data, name, result);
    },
    renderChildren: function (view, token, option, $scope) {
        //清空监听
        this.clearWatchers(token);

        let childNodes = token.node.childNodes;

        [...childNodes].forEach((node) => {
            this.addWatchers(compileNodes(node, option, $scope));
        });

        view.componentChildNodes = childNodes;
    },
    _checkPropType: function (types, value) {
        let match = false, valueType = Utils.isArray(value) ? "array" : typeof (value);

        if (Utils.isArray(types) === false) types = [types];

        for (let type of types) {
            PropTypes[type] = PropTypes[type] || this._getPropType(type.toString());

            if (valueType === PropTypes[type]) {
                match = true;
                break;
            }
        };

        return match;
    },
    _getPropType: function (fn) {
        const match = fn && fn.toString().match(/^\s*function (\w+)/)
        return (match ? match[1] : '').toLocaleLowerCase();
    }
});