"""Cobra NATS development crew — analysis and planning only."""

from __future__ import annotations

import os
from typing import Any

from crewai import Agent, Crew, LLM, Process, Task
from crewai.project import CrewBase, agent, crew, task

from cobra_nats_crew.tools.factory import build_agent_tools


def _model_name() -> str:
    return os.getenv("MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4o"


def _llm() -> LLM:
    return LLM(model=_model_name())


def _truthy(name: str, default: str = "true") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _process() -> Process:
    raw = os.getenv("CREW_PROCESS", "hierarchical").strip().lower()
    if raw == "sequential":
        return Process.sequential
    return Process.hierarchical


@CrewBase
class CobraNatsCrew:
    """Specialist crew for cobra-nats. Outputs markdown; never touches git."""

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    def __init__(self) -> None:
        self._tools: list[Any] | None = None

    def tools(self) -> list[Any]:
        if self._tools is None:
            self._tools = build_agent_tools()
        return self._tools

    @agent
    def repo_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config["repo_analyst"],
            tools=self.tools(),
            llm=_llm(),
            verbose=True,
            allow_delegation=False,
            max_iter=20,
        )

    @agent
    def docs_writer(self) -> Agent:
        return Agent(
            config=self.agents_config["docs_writer"],
            tools=self.tools(),
            llm=_llm(),
            verbose=True,
            allow_delegation=False,
            max_iter=15,
        )

    @agent
    def test_engineer(self) -> Agent:
        return Agent(
            config=self.agents_config["test_engineer"],
            tools=self.tools(),
            llm=_llm(),
            verbose=True,
            allow_delegation=False,
            max_iter=15,
        )

    @agent
    def performance_optimizer(self) -> Agent:
        return Agent(
            config=self.agents_config["performance_optimizer"],
            tools=self.tools(),
            llm=_llm(),
            verbose=True,
            allow_delegation=False,
            max_iter=15,
        )

    @agent
    def feature_planner(self) -> Agent:
        return Agent(
            config=self.agents_config["feature_planner"],
            tools=self.tools(),
            llm=_llm(),
            verbose=True,
            allow_delegation=False,
            max_iter=15,
        )

    @agent
    def manager(self) -> Agent:
        return Agent(
            config=self.agents_config["manager"],
            llm=_llm(),
            verbose=True,
            allow_delegation=True,
            max_iter=12,
        )

    @task
    def architecture_analysis(self) -> Task:
        return Task(config=self.tasks_config["architecture_analysis"])

    @task
    def documentation_improvements(self) -> Task:
        return Task(
            config=self.tasks_config["documentation_improvements"],
            context=[self.architecture_analysis()],
        )

    @task
    def test_coverage_expansion(self) -> Task:
        return Task(
            config=self.tasks_config["test_coverage_expansion"],
            context=[self.architecture_analysis()],
        )

    @task
    def performance_optimizations(self) -> Task:
        return Task(
            config=self.tasks_config["performance_optimizations"],
            context=[self.architecture_analysis()],
        )

    @task
    def feature_planning(self) -> Task:
        return Task(
            config=self.tasks_config["feature_planning"],
            context=[
                self.architecture_analysis(),
                self.documentation_improvements(),
                self.test_coverage_expansion(),
                self.performance_optimizations(),
            ],
        )

    @task
    def consolidated_report(self) -> Task:
        return Task(
            config=self.tasks_config["consolidated_report"],
            context=[
                self.architecture_analysis(),
                self.documentation_improvements(),
                self.test_coverage_expansion(),
                self.performance_optimizations(),
                self.feature_planning(),
            ],
        )

    def _worker_agents(self) -> list[Agent]:
        manager_role = self.manager().role
        return [agent for agent in self.agents if agent.role != manager_role]

    @crew
    def crew(self) -> Crew:
        process = _process()
        memory = _truthy("CREW_MEMORY")
        planning = _truthy("CREW_PLANNING")
        check_mode = _truthy("CREW_CHECK", "false")
        if check_mode:
            memory = False
            planning = False

        common: dict[str, Any] = {
            "tasks": self.tasks,
            "verbose": not check_mode,
            "memory": memory,
            "planning": planning,
            "cache": True,
        }

        if process is Process.hierarchical:
            return Crew(
                agents=self._worker_agents(),
                process=Process.hierarchical,
                manager_agent=self.manager(),
                manager_llm=_llm(),
                **common,
            )

        return Crew(
            agents=list(self.agents),
            process=Process.sequential,
            **common,
        )
