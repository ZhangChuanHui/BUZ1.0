import log from "../common/log";
import { Watcher } from '../observer';
import { LOGTAG } from './index';
import Utils from "../common/utils";
import expression from './expression';


/**
 *  作者：张传辉
 *  功能名称：指令处理
 *  描述信息：
*/
export default {
    orderList: {},
    helps: {},
    addOrder: function (param = {
        name: undefined,
        exec: undefined
    }) {
        param
            && param.name
            && param.exec
            && (this.orderList[param.name] = Object.assign({
                //是否跳过子集
                isSkipChildren: false,
                //权重
                weight: 0,
                breforeExec: function (token, option) { },
                runExpress: function (token, option, scope) {
                    return this.tryRun(token.exp, scope, option);
                },
                tryRun: function (exp, scope, option) {
                    try {
                        return expression(exp, scope, option);
                    }
                    catch (e) {
                        return exp;
                    }
                },
                clearWatchers: function (token) {
                    //清空监听
                    if (token.watchers) {
                        token.watchers.forEach((item) => {
                            item.stop();
                        });
                    }

                    token.watchers = [];
                },
                addWatchers: function (token, watchers = []) {
                    token.watchers = token.watchers || [];
                    token.watchers.concat(watchers);
                }
            }, param));
    },
    addHelper: function (name, func) {
        name && (this.helps[name] = func);
    },
    /**
     * 执行指令
     * @param node 节点 <Element>
     * @param tokens 特征标记集 <Object> 
     * @param option 执行配置信息 <Object>
    */
    exec: function (node, tokens, option = {
        view: undefined,
        data: undefined,
        refNode: undefined
    }, scope) {
        let isSkipChildren = false;

        let watchers = [];

        tokens = this.sortTokens(tokens);

        for (let token of tokens) {
            let order = this.orderList[token.order];

            if (order.isSkipChildren) isSkipChildren = true;

            if (order === undefined) {
                log.warn(LOGTAG, `未找到${token.order}指令名`);
                continue;
            }

            if (node.parentNode) {
                token.node = node;
                token.$node = $(node);

                //移除标记
                token.removeAttr && token.removeAttr();

                scope = scope || option.data;
                //before Exec
                order.breforeExec(token, option, scope);

                let exec = (nv, ov, isFirst, always) => {
                    if (always !== true && nv === token.oldValue) return;

                    order.exec(Object.assign({
                        //保留token/option把柄作为后期oder存放依据
                        $token: token,
                        $option: option,
                        isFirst: isFirst,
                        scope: scope
                    }, token, option), nv, token.oldValue);

                    token.oldValue = nv;
                }

                if (token.exp) {
                    let watcher = new Watcher(scope,
                        function (scope) {
                            return order.runExpress(token, option, scope);
                        }, exec, token);

                    exec(watcher.value, undefined, true);

                    option.view.watchers.push(watcher);
                    watchers.push(watcher);
                }
                else {
                    exec(undefined, undefined, true, true);
                }
            }
        }

        return {
            isSkipChildren: isSkipChildren,
            watchers: watchers
        };
    },
    sortTokens: function (tokens) {
        return tokens.sort((item1, item2) => {
            let order1 = this.orderList[item1.order];
            let order2 = this.orderList[item2.order];

            if (order1 && order2) {
                return order1.weight < order2.weight;
            }
        });
    }
}