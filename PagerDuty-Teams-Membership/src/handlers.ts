import {ResourceModel} from './models';
import {AbstractPagerDutyResource} from "../../PagerDuty-Common/src/abstract-pager-duty-resource";
import {PagerDutyClient, PaginatedResponseType} from "../../PagerDuty-Common/src/pager-duty-client";
import {exceptions} from "@amazon-web-services-cloudformation/cloudformation-cli-typescript-lib";
import {AxiosError} from "axios";

type MembersResponse = {
    members: Member[]
} & PaginatedResponseType;

type Member = {
    user: User
    role: string
}

type User = {
    id: string
}

class Resource extends AbstractPagerDutyResource<ResourceModel, ResourceModel, void, void> {
    async get(model: ResourceModel): Promise<ResourceModel> {
        const resourceModel = (await this.list(model)).find(returnedModel => returnedModel.userId === model.userId);
        if (resourceModel) {
            return resourceModel;
        }
        // Because there is no get endpoint, we are using the list endpoint + simulating a 404 response to trigger
        // the right behaviour, if the resource is not found within the list.
        const axiosError = new AxiosError('Resource not found from list');
        axiosError.status = '404';
        throw axiosError;
    }

    async list(model: ResourceModel): Promise<ResourceModel[]> {
        return await new PagerDutyClient(model.pagerDutyAccess).paginate<MembersResponse, ResourceModel>(
            'get',
            `/teams/${model.teamId}/members`,
            response => response.data.members.map(member => new ResourceModel({
                teamId: model.teamId,
                userId: member.user.id,
                role: member.role
            })),
            {limit: 100});
    }

    async create(model: ResourceModel): Promise<void> {
        await new PagerDutyClient(model.pagerDutyAccess).doRequest('put', `/teams/${model.teamId}/users/${model.userId}`, {}, {
            role: model.role
        });
    }

    async update(model: ResourceModel): Promise<void> {
        throw new exceptions.NotUpdatable();
    }

    async delete(model: ResourceModel): Promise<void> {
        await new PagerDutyClient(model.pagerDutyAccess).doRequest('delete', `/teams/${model.teamId}/users/${model.userId}`);
    }

    newModel(partial?: any): ResourceModel {
        return new ResourceModel(partial);
    }

    setModelFrom(model: ResourceModel, from?: ResourceModel): ResourceModel {
        return new ResourceModel({
            ...model,
            ...(from || {})
        });
    }

}

export const resource = new Resource(ResourceModel.TYPE_NAME, ResourceModel);

// Entrypoint for production usage after registered in CloudFormation
export const entrypoint = resource.entrypoint;

// Entrypoint used for local testing
export const testEntrypoint = resource.testEntrypoint;
