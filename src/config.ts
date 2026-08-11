import config from "config";

export interface IPermissionCheck {
    roomReminders: string;
}

export interface IConfig {
    homeserverUrl: string;
    accessToken: string;
    autoJoin: boolean;
    dataPath: string;
    permissionCheck: IPermissionCheck;
    admins: string[];
}

const appConfig: IConfig = {
    homeserverUrl: config.get<string>("homeserverUrl"),
    accessToken: config.get<string>("accessToken"),
    autoJoin: config.get<boolean>("autoJoin"),
    dataPath: config.get<string>("dataPath"),
    permissionCheck: config.get<IPermissionCheck>("permissionCheck"),
    admins: config.get<string[]>("admins"),
};

export default appConfig;
