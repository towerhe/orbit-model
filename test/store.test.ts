import Coordinator, { RequestStrategy, SyncStrategy } from '@orbit/coordinator';
import JSONAPISource, { Resource, ResourceDocument } from '@orbit/jsonapi';
import MemorySource from '@orbit/memory';
import { RecordKeyMap, RecordSchema } from '@orbit/records';
import 'isomorphic-fetch';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { initialize } from '../src/factories/schema-factory';
import Store from '../src/store';
import { jsonapiResponse } from './setup/jsonapi';
import { Moon, Planet } from './setup/models';

describe('Store', () => {
    let fetchStub: SinonStub;
    let schema: RecordSchema;
    let keyMap: RecordKeyMap;
    let memory: MemorySource;
    let jsonapi: JSONAPISource;
    let coordinator: Coordinator;
    let store: Store;

    beforeEach(() => {
        fetchStub = sinon.stub(global, 'fetch');

        schema = initialize({
            // @ts-ignore
            planet: Planet,
            // @ts-ignore
            moon: Moon
        });

        keyMap = new RecordKeyMap();
        memory = new MemorySource({
            schema,
            keyMap,
        });
        jsonapi = new JSONAPISource({
            schema,
            keyMap,
        });
        coordinator = new Coordinator({
            sources: [memory, jsonapi],
        });
        // coordinator.addStrategy(new EventLoggingStrategy());
        // Query the remote server whenever the memory source is queried
        coordinator.addStrategy(
            new RequestStrategy({
                source: 'memory',
                on: 'beforeQuery',

                target: 'jsonapi',
                action: 'query',

                blocking: true,
            }),
        );
        // Update the remote server whenever the memory source is updated
        coordinator.addStrategy(
            new RequestStrategy({
                source: 'memory',
                on: 'beforeUpdate',

                target: 'jsonapi',
                action: 'update',

                blocking: true,
            }),
        );
        coordinator.addStrategy(
            new SyncStrategy({
                source: 'jsonapi',
                target: 'memory',
                blocking: true,
            }),
        );
        coordinator.activate();

        store = Store.create({ source: memory });
    });

    afterEach(() => {
        coordinator.deactivate();
        fetchStub.restore();
    });

    test('it exists', () => {
        expect(store).not.toBeNull();
    });

    test('#findRecord', async () => {
        const data: Resource = {
            type: 'planet',
            id: '12345',
            attributes: { name: 'Jupiter' },
        };

        fetchStub.withArgs('/planets/12345').returns(jsonapiResponse(200, { data }));

        let result = await store.findRecord({ type: 'planet', key: 'remoteId', value: '12345' });

        expect(result?.$getAttribute('name')).toEqual('Jupiter');
    });

    test('#findRecord - can get the related record responsed by a compound document', async () => {
        const doc: ResourceDocument = {
            data: {
                id: 'moon',
                type: 'moon',
                attributes: { name: 'Moon' },
                relationships: {
                    planet: { data: { id: 'earth', type: 'planet' } },
                },
            },
            included: [
                {
                    type: 'planet',
                    id: 'earth',
                    attributes: {
                        name: 'Earth',
                    },
                },
            ],
        };

        fetchStub.withArgs('/moons/moon').returns(jsonapiResponse(200, doc));

        let moon = await store.findRecord({ type: 'moon', key: 'remoteId', value: 'moon' });

        expect(moon).not.toBeNull();

        let earth = moon?.$getRelatedRecord('planet');

        expect(earth).not.toBeNull();
        expect(earth?.$getAttribute('name')).toEqual('Earth');
    });
});
