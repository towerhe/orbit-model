import { Model, key, attr, hasMany, hasOne } from 'index';

export class Planet extends Model {
    @key() remoteId: string | undefined;
    @attr('string') name: string | undefined;
    @hasMany('moon') moons: Moon[] | undefined;
}

export class Moon extends Model {
    @key() remoteId: string | undefined;
    @attr('string') name: string | undefined;
    @hasOne('planet') planet: Planet | undefined;
}
