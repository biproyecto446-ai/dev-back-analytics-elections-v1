import type { Departamento } from '../../domain/entities/Departamento';
import type { DepartamentoRepository } from '../../domain/ports/DepartamentoRepository';

export class GetDepartamentosUseCase {
  constructor(private readonly repository: DepartamentoRepository) {}

  async execute(): Promise<Departamento[]> {
    return this.repository.findAll();
  }
}
