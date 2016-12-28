import * as blessed from 'blessed';

export default class HelpController {
  private args: string[];
  private helpProgram: string;
  private screen: blessed.Widgets.Screen;

  constructor(helpProgram: string, helpProgramArgs: string[], contentFile: string, screen: Node) {
    this.args = helpProgramArgs.concat([contentFile]);
    this.helpProgram = helpProgram;
  }

  public help(): void {
    this.screen.exec(this.helpProgram, this.args, {}, () => {});
    this.screen.render();
  }
}
