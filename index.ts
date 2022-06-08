import controller from './controller';
import * as config from 'config';

const serverConfigs = config.get('server');
const functionsConfig = config.get('functions');
/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.run = async (req, res) => {
    const action = req.query.action;
    console.log('action', action);
    if (!action) {
        res.send('Action is not specified')
        return;
    }
    console.log('key', functionsConfig.key, req.headers.apikey, req.headers)
    if (req.headers.apikey !== functionsConfig.key) {
        res.status(401)
        res.send('Access denied')
        return;
    }
    const param = req.query.param || '';
    try {
        const result = await controller[action](param, req.body)
        res.send(result);
    } catch (e) {
        console.log('Error', e.message);
        if (e.message === 'Timeout') {
            res.status(429);
        } else {
            res.status(422);
        }
        res.send(e.message)
    }

}
