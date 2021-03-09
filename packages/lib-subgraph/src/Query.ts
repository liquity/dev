import { ApolloClient, ApolloQueryResult, DocumentNode } from "@apollo/client";

export class Query<T, U, V = undefined> {
  private readonly query: DocumentNode;
  private readonly mapResult: (result: ApolloQueryResult<U>, variables: V) => T;

  constructor(query: DocumentNode, mapResult: (result: ApolloQueryResult<U>, variables: V) => T) {
    this.query = query;
    this.mapResult = mapResult;
  }

  get(client: ApolloClient<unknown>, variables: V) {
    return client
      .query<U, V>({ query: this.query, variables })
      .then(result => this.mapResult(result, variables));
  }

  watch(client: ApolloClient<unknown>, onChanged: (value: T) => void, variables: V) {
    const subscription = client
      .watchQuery<U, V>({ query: this.query, variables })
      .subscribe(result => onChanged(this.mapResult(result, variables)));

    return () => subscription.unsubscribe();
  }
}
